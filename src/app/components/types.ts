export interface Slot {
  id: string;
  name: string;
  color: string;
  dotColor: string;
  filePath: string;
  shortLabel: string;
  isSource?: boolean; // Mark if this is the source slot
}

export interface SourceConfig {
  path: string;
}

export interface SlotAssignment {
  slotId: string;
  active: boolean;
  previewPath?: string;
}

export interface SkillPackage {
  id: string;
  name: string;
  slots: SlotAssignment[];
  previewContent: string;
  lastModified: string;
  packagePath?: string;
  previewPath?: string;
}

export type SkillFile = SkillPackage;
