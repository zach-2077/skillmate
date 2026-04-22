import React from 'react';
import { Box, Text } from 'ink';

export function SearchBar({
  query,
  active,
  placeholder = 'Search…',
}: {
  query: string;
  active: boolean;
  placeholder?: string;
}): React.ReactElement {
  return (
    <Box borderStyle="single" borderColor={active ? 'yellow' : 'gray'} paddingX={1}>
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
