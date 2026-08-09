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

export function LoginScreen() {
  const { login, signup } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = email.length > 0 && password.length >= 6;

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(email, password, name);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(message);
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
          <View className="items-center mb-10">
            <Ionicons name="flame" size={64} color="#E63946" />
            <Text className="text-white text-3xl font-extrabold mt-4 tracking-tight">Fitso</Text>
            <Text className="text-[#A0A0A0] text-sm mt-2">
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
                className="bg-[#121212] text-white rounded-2xl px-4 py-3.5 text-base"
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
              className="bg-[#121212] text-white rounded-2xl px-4 py-3.5 text-base"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View className="mb-6">
            <Text className="text-[#A0A0A0] text-xs font-semibold mb-1.5 uppercase">Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#A0A0A0"
              className="bg-[#121212] text-white rounded-2xl px-4 py-3.5 text-base"
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          {error && (
            <View className="mb-4 p-3 bg-[#E63946]/10 rounded-xl border border-[#E63946]/30">
              <Text className="text-[#E63946] text-sm font-medium">{error}</Text>
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.85}
            disabled={!isValid || loading}
            onPress={handleSubmit}
            className={`rounded-2xl py-4 mb-6 ${!isValid || loading ? 'bg-[#E63946]/50' : 'bg-[#E63946]'}`}
          >
            <Text className="text-white text-center font-bold text-base">
              {loading ? (isLogin ? 'Signing in...' : 'Creating account...') : isLogin ? 'Sign In' : 'Create Account'}
            </Text>
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
