import { Platform } from 'react-native';

// Đọc to 1 câu bằng giọng Việt. Lazy require để không crash nếu native module thiếu.
export function speak(text: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Speech = require('expo-speech');
    Speech.stop?.(); // ngắt câu đang đọc dở (nếu có) để câu mới nghe rõ
    Speech.speak(text, {
      language: 'vi-VN',
      pitch: 1.0,
      rate: Platform.OS === 'ios' ? 0.5 : 1.0,
    });
  } catch {
    /* native module chưa có — bỏ qua im lặng */
  }
}
