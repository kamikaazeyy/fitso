import React from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getAttachmentsForEquipment, type Attachment } from '@/constants/attachments';

interface AttachmentPickerProps {
  visible: boolean;
  exerciseName: string;
  equipment: string[];
  selectedId?: string | null;
  onClose: () => void;
  onSelect: (attachment: Attachment) => void;
}

export function AttachmentPicker({
  visible,
  exerciseName,
  equipment,
  selectedId,
  onClose,
  onSelect,
}: AttachmentPickerProps) {
  const attachments = getAttachmentsForEquipment(equipment);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 bg-black/80 justify-center items-center px-6">
          <TouchableWithoutFeedback>
            <View className="w-full max-w-sm bg-[#121212] rounded-[24px] p-4 max-h-[70%]">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-white text-lg font-bold flex-1 mr-2" numberOfLines={1}>
                  {exerciseName}
                </Text>
                <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                  <Ionicons name="close" size={24} color="#A0A0A0" />
                </TouchableOpacity>
              </View>
              <Text className="text-[#A0A0A0] text-sm mb-3">Select attachment</Text>

              <FlatList
                data={attachments}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const isSelected = item.id === selectedId;
                  return (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        onSelect(item);
                        onClose();
                      }}
                      className={`flex-row items-center justify-between p-4 mb-2 rounded-2xl ${
                        isSelected ? 'bg-[#E63946]' : 'bg-[#1C1C1E]'
                      }`}
                    >
                      <Text
                        className={`text-base font-semibold ${
                          isSelected ? 'text-white' : 'text-white'
                        }`}
                      >
                        {item.name}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
