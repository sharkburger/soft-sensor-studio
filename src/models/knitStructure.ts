export type EvidenceLevel = 'measured' | 'qualitative' | 'unknown';
export interface Evidence { level: EvidenceLevel; text: string; source?: string }
export interface Measurement { metric: 'stretchX'|'stretchY'|'recovery'|'thickness'|'forceExtension'|'hysteresis'; values: number[]; units: string; method: string; sampleId: string; provenance: string; conditions: string }
export interface KnitStructure {
 id: string; aliases?: string[]; technicalReferences?: {name:string;url:string}[]; name: string; category: string; construction: 'Single knit'|'Double knit'|'Unknown'; description: string;
 catalogSlot: string; classificationSource?: string; pattern?: string[]; referenceNumber?: string; proposedReference?: string; verificationStatus: 'verified'|'pending';
 repeat: {columns:number;rows:number}; reversible: boolean|null; stretch: 'High'|'Moderate'|'Unknown'; stability: 'Lower'|'Higher'|'Unknown';
 properties: Record<'crosswiseStretch'|'lengthwiseStretch'|'recovery'|'curling'|'stability'|'thickness', Evidence>;
 visualizationStatus: 'schematic'|'notAvailable'; cadSupported: boolean; application: string; limitation: string;
 provenance: {classification:string; visualization:string; mechanics:string}; measurements: Measurement[];
}
