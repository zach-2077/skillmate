import React from 'react';
import { Box, Text } from 'ink';

export function Footer({ keys }: { keys: ReadonlyArray<[string, string]> }): React.ReactElement {
  return (
    <Box paddingX={1} borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false}>
      <Text dimColor>
        {keys.map(([k, label], i) => (
          <Text key={k}>
            {i > 0 ? '  ' : ''}[{k}] {label}
          </Text>
        ))}
      </Text>
    </Box>
  );
}
