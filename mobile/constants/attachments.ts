export type Attachment = {
  id: string;
  name: string;
};

export const ATTACHMENTS: Record<string, Attachment[]> = {
  'Cable machine': [
    { id: 'cable_rope', name: 'Rope' },
    { id: 'cable_straight_bar', name: 'Straight bar' },
    { id: 'cable_v_bar', name: 'V-bar' },
    { id: 'cable_d_handle', name: 'D-handle (single)' },
    { id: 'cable_d_handles', name: 'D-handles (pair)' },
    { id: 'cable_ankle_cuff', name: 'Ankle cuff' },
    { id: 'cable_rope_hammer', name: 'Rope (hammer grip)' },
    { id: 'cable_ez_bar', name: 'EZ-curl bar attachment' },
    { id: 'mag_grip_wide', name: 'MAG grip — wide' },
    { id: 'mag_grip_neutral', name: 'MAG grip — neutral' },
    { id: 'mag_grip_close', name: 'MAG grip — close' },
    { id: 'mag_grip_medium', name: 'MAG grip — medium' },
    { id: 'mag_grip_parallel', name: 'MAG grip — parallel' },
    { id: 'mag_grip_supinated', name: 'MAG grip — supinated' },
    { id: 'mag_grip_pronated', name: 'MAG grip — pronated' },
  ],
  Barbell: [
    { id: 'barbell_standard', name: 'Standard barbell' },
    { id: 'barbell_ez', name: 'EZ / SZ bar' },
    { id: 'barbell_trap', name: 'Trap bar' },
    { id: 'barbell_safety_squat', name: 'Safety squat bar' },
    { id: 'barbell_multi_grip', name: 'Multi-grip / Swiss bar' },
    { id: 'fat_gripz', name: 'Fat Gripz' },
  ],
  Dumbbell: [
    { id: 'dumbbell_standard', name: 'Standard dumbbell' },
    { id: 'dumbbell_adjustable', name: 'Adjustable dumbbell' },
    { id: 'dumbbell_fat', name: 'Fat dumbbell' },
  ],
  'Pull-up bar': [
    { id: 'pullup_wide', name: 'Wide grip' },
    { id: 'pullup_neutral', name: 'Neutral grip' },
    { id: 'pullup_close', name: 'Close grip' },
    { id: 'pullup_assisted_band', name: 'Assisted band' },
    { id: 'pullup_weighted', name: 'Weighted belt' },
  ],
  'Resistance band': [
    { id: 'band_loop', name: 'Loop band' },
    { id: 'band_tube', name: 'Tube with handles' },
    { id: 'band_mini', name: 'Mini band' },
  ],
  Kettlebell: [
    { id: 'kettlebell_standard', name: 'Standard kettlebell' },
    { id: 'kettlebell_competition', name: 'Competition kettlebell' },
  ],
};

export const ALL_ATTACHMENTS = Object.values(ATTACHMENTS).flat();

const NONE_ATTACHMENT: Attachment = { id: 'none', name: 'No attachment' };

export function getAttachmentsForEquipment(equipmentNames: string[]): Attachment[] {
  const seen = new Set<string>();
  const result: Attachment[] = [];

  for (const name of equipmentNames) {
    const list = ATTACHMENTS[name] ?? [];
    for (const item of list) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        result.push(item);
      }
    }
  }

  return [NONE_ATTACHMENT, ...result];
}
