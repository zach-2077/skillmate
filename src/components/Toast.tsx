import React from 'react';
import { Box, Text } from 'ink';
import type { Toast as ToastType } from '../store.js';

const COLOR_BY_KIND: Record<ToastType['kind'], string> = {
  info: 'blue',
  success: 'green',
  error: 'red',
};

export function ToastList({ toasts }: { toasts: ToastType[] }): React.ReactElement | null {
  if (toasts.length === 0) return null;
  return (
    <Box flexDirection="column" paddingX={1}>
      {toasts.map((t) => (
        <Text key={t.id} color={COLOR_BY_KIND[t.kind]}>
          {t.kind === 'error' ? '✗' : '•'} {t.text}
        </Text>
      ))}
    </Box>
  );
}
