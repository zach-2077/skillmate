import React from 'react';
import { Box, Text } from 'ink';

export function Header({ agent }: { agent: string }): React.ReactElement {
  return (
    <Box paddingX={1} justifyContent="space-between">
      <Text bold>skills-gov</Text>
      <Text dimColor>agent: {agent}</Text>
    </Box>
  );
}
