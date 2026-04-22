import React from 'react';
import { Box, Text } from 'ink';

export function Header({ agent }: { agent: string }): React.ReactElement {
  return (
    <Box paddingX={1}>
      <Text bold>agent: {agent}</Text>
    </Box>
  );
}
