// components/ContainerPicker.tsx
// Header button showing the selected container; tapping it opens a list to switch.
import { useState } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';
import { Text, useTheme } from '@/components/Themed';
import { useContainers } from '@/lib/containers';

export default function ContainerPicker() {
  const theme = useTheme();
  const { containers, selected, select } = useContainers();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={[styles.button, { backgroundColor: theme.primarySoft, borderColor: theme.border }]}
      >
        <Text style={[styles.buttonText, { color: theme.tint }]} numberOfLines={1}>
          📦 {selected ?? 'All containers'}
        </Text>
        <Text style={[styles.chevron, { color: theme.tint }]}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={styles.sheetTitle}>Select container</Text>

            {containers.length === 0 && (
              <Text style={[styles.empty, { color: theme.textMuted }]}>
                No containers yet. They appear automatically when a reading with a "container" field arrives.
              </Text>
            )}

            {containers.map((c) => {
              const active = selected === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => {
                    select(c);
                    setOpen(false);
                  }}
                  style={[
                    styles.option,
                    {
                      borderColor: active ? theme.tint : theme.border,
                      backgroundColor: active ? theme.primarySoft : 'transparent',
                    },
                  ]}
                >
                  <Text style={[styles.optionName, { flex: 1 }, active && { color: theme.tint }]}>📦 {c}</Text>
                  {active && <Text style={[styles.check, { color: theme.tint }]}>✓</Text>}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 200,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 12,
  },
  buttonText: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  chevron: { fontSize: 12, marginLeft: 6 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', marginBottom: 14 },
  empty: { fontSize: 14, marginBottom: 12 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  optionName: { fontSize: 16, fontWeight: '700' },
  check: { fontSize: 18, fontWeight: '700' },
});
