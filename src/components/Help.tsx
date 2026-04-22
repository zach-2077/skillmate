import React from 'react';
import { Box, Text } from 'ink';

export function Help(): React.ReactElement {
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1} marginX={1}>
      <Text bold>skills-gov keybinds</Text>
      <Text> </Text>
      <Text dimColor>Global</Text>
      <Text>[left/right] cycle tabs   [?] toggle help   [q] quit</Text>
      <Text> </Text>
      <Text dimColor>Installed</Text>
      <Text>[/] filter   [up/down] move   [tab] switch agent</Text>
      <Text>[d] remove   [u] update</Text>
      <Text> </Text>
      <Text dimColor>Discover</Text>
      <Text>[/] search   [up/down] move   [enter] detail   [i] install</Text>
      <Text> </Text>
      <Text dimColor>Detail</Text>
      <Text>[up/down] scroll   [esc] back</Text>
      <Text> </Text>
      <Text dimColor>Settings</Text>
      <Text>[up/down] move   [space] toggle   [enter] save   [esc] cancel</Text>
    </Box>
  );
}
