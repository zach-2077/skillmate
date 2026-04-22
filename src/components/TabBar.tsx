import React from 'react';
import { Box, Text } from 'ink';

export type TabKey = 'installed' | 'search' | 'settings';

interface Tab {
  key: TabKey;
  label: string;
}

const TABS: Tab[] = [
  { key: 'installed', label: 'Installed' },
  { key: 'search', label: 'Discover' },
  { key: 'settings', label: 'Settings' },
];

export function TabBar({
  active,
  agent,
}: {
  active: TabKey;
  agent?: string;
}): React.ReactElement {
  return (
    <Box paddingX={1} justifyContent="space-between">
      <Box>
        {TABS.map((t, i) => (
          <React.Fragment key={t.key}>
            {i > 0 && <Text> </Text>}
            {t.key === active ? (
              <Text inverse bold>
                {' '}
                {t.label}
                {' '}
              </Text>
            ) : (
              <Text dimColor>
                {' '}
                {t.label}
                {' '}
              </Text>
            )}
          </React.Fragment>
        ))}
      </Box>
      {agent !== undefined && <Text dimColor>agent: {agent}</Text>}
    </Box>
  );
}
