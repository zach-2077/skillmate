import React from 'react';
import { Box, Text } from 'ink';

function terminalWidth(): number {
  return process.stdout.columns ?? 80;
}

export function SearchBar({
  query,
  active,
  placeholder = 'Search…',
}: {
  query: string;
  active: boolean;
  placeholder?: string;
}): React.ReactElement {
  const width = Math.max(20, Math.floor(terminalWidth() * 0.9));
  return (
    <Box
      width={width}
      borderStyle="single"
      borderColor={active ? 'yellow' : 'gray'}
      paddingX={1}
    >
      <Text dimColor>⌕ </Text>
      {query ? (
        <Box>
          <Text>{query}</Text>
          {active ? <Text inverse> </Text> : null}
        </Box>
      ) : active ? (
        <Text inverse> </Text>
      ) : (
        <Text dimColor>{placeholder}</Text>
      )}
    </Box>
  );
}
