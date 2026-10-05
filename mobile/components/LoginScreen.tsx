import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/constants/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginScreen() {
  const { login, signup, continueAsGuest } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedEmail = email.trim();
  const emailInvalid = trimmedEmail.length > 0 && !EMAIL_RE.test(trimmedEmail);
  const isValid = EMAIL_RE.test(trimmedEmail) && password.length >= 6;

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      if (isLogin) {
        await login(trimmedEmail, password);
      } else {
        await signup(trimmedEmail, password, name.trim() || undefined);
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('econnrefused')) {
        setError('Cannot reach remote server. You can tap "Continue as Guest" below to start tracking offline immediately.');
      } else {
        setError(msg || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await continueAsGuest(name || 'Athlete', email || 'athlete@fitso.local');
    } catch (err: any) {
      setError(err?.message || 'Failed to start offline mode.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ justifyContent: 'center', flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="items-center mb-8">
            <Ionicons name="flame" size={64} color="#E63946" />
            <Text className="text-white text-3xl font-extrabold mt-3 tracking-tight">Fitso</Text>
            <Text className="text-[#A0A0A0] text-sm mt-1">
              {isLogin ? 'Sign in to your account' : 'Create a new account'}
            </Text>
          </View>

          {!isLogin && (
            <View className="mb-4">
              <Text className="text-[#A0A0A0] text-xs font-semibold mb-1.5 uppercase">Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor="#A0A0A0"
                className="bg-[#121212] text-white rounded-2xl px-4 py-3.5 text-base border border-[#2C2C2E]"
                autoCapitalize="words"
              />
            </View>
          )}

          <View className="mb-4">
            <Text className="text-[#A0A0A0] text-xs font-semibold mb-1.5 uppercase">Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#A0A0A0"
              className="bg-[#121212] text-white rounded-2xl px-4 py-3.5 text-base border border-[#2C2C2E]"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {emailInvalid && (
              <Text className="text-[#E63946] text-xs mt-1.5">Enter a valid email address</Text>
            )}
          </View>

          <View className="mb-5">
            <Text className="text-[#A0A0A0] text-xs font-semibold mb-1.5 uppercase">Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#A0A0A0"
              className="bg-[#121212] text-white rounded-2xl px-4 py-3.5 text-base border border-[#2C2C2E]"
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          {error && (
            <View className="mb-5 p-3.5 bg-[#E63946]/10 rounded-2xl border border-[#E63946]/30">
              <View className="flex-row items-center mb-1">
                <Ionicons name="alert-circle" size={16} color="#E63946" />
                <Text className="text-[#E63946] text-xs font-bold uppercase ml-1.5">Connection Notice</Text>
              </View>
              <Text className="text-[#FF8B94] text-xs leading-4">{error}</Text>
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.85}
            disabled={!isValid || loading}
            onPress={handleSubmit}
            className={`rounded-2xl py-4 mb-3 ${!isValid || loading ? 'bg-[#E63946]/50' : 'bg-[#E63946]'}`}
          >
            <Text className="text-white text-center font-bold text-base">
              {loading ? (isLogin ? 'Signing in...' : 'Creating account...') : isLogin ? 'Sign In' : 'Create Account'}
            </Text>
          </TouchableOpacity>

          {/* Offline / Guest Mode Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            disabled={loading}
            onPress={handleGuestLogin}
            className="bg-[#18181B] border border-[#2C2C2E] rounded-2xl py-3.5 mb-6 flex-row items-center justify-center"
          >
            <Ionicons name="flash-outline" size={18} color="#34D399" />
            <Text className="text-white font-bold text-sm ml-2">Continue as Guest (Offline Mode)</Text>
          </TouchableOpacity>

          <View className="flex-row justify-center">
            <Text className="text-[#A0A0A0] text-sm">
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
            </Text>
            <TouchableOpacity onPress={() => setIsLogin(!isLogin)} activeOpacity={0.7}>
              <Text className="text-[#E63946] text-sm font-bold">
                {isLogin ? 'Sign up' : 'Sign in'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
