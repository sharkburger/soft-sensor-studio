import type { CircuitKind } from "../models/circuit";
export interface CircuitProfile {
  id: string;
  name: string;
  category: string;
  kind?: CircuitKind;
  conductive: boolean;
  description: string;
  consideration: string;
}
export const circuitLibrary: CircuitProfile[] = [
  {
    id: "battery-pack",
    name: "Battery pack location — concept",
    category: "Power source",
    kind: "battery",
    conductive: false,
    description: "A reserved placement block with VBAT+ and GND− terminals.",
    consideration: "This is a layout placeholder. Battery chemistry, voltage, protection, enclosure and power routing are not modeled.",
  },
  {
    id: "c-yarn",
    name: "Conductive yarn — generic",
    category: "Conductive yarn",
    kind: "trace",
    conductive: true,
    description: "Concept profile for stitched or knitted conductive routing.",
    consideration:
      "Resistance, stretch response, wash durability and joining method are unknown.",
  },
  {
    id: "c-fabric",
    name: "Conductive fabric — generic",
    category: "Conductive fabric",
    kind: "electrode",
    conductive: true,
    description: "Concept patch material for contact pads or electrodes.",
    consideration:
      "Verify edge fraying, attachment, isolation and skin-contact suitability.",
  },
  {
    id: "dielectric",
    name: "Dielectric spacer — generic",
    category: "Dielectric material",
    kind: "insulation",
    conductive: false,
    description: "Concept insulating separator between conductive layers.",
    consideration:
      "Permittivity, compression, breakdown and thickness are unmeasured.",
  },
  {
    id: "resistive",
    name: "Resistive sensing region — concept",
    category: "Resistive sensor",
    kind: "sensing-region",
    conductive: true,
    description: "A layout concept for a resistance-based sensing region.",
    consideration:
      "No resistance or strain prediction. Requires readout design, calibration and hysteresis testing.",
  },
  {
    id: "capacitive",
    name: "Capacitive sensing region — concept",
    category: "Capacitive sensor",
    kind: "sensing-region",
    conductive: true,
    description: "A plan-view placeholder for a capacitive assembly.",
    consideration:
      "Requires separate electrode layers, dielectric and readout hardware; a flat region is not a complete capacitor.",
  },
  {
    id: "electrode",
    name: "Textile contact electrode — concept",
    category: "Electrode",
    kind: "electrode",
    conductive: true,
    description:
      "An editable contact area, with no specified physiological measurement.",
    consideration:
      "Verify contact impedance, placement and skin compatibility. No clinical performance is inferred.",
  },
  {
    id: "connector",
    name: "Connector terminal — generic",
    category: "Connector",
    kind: "terminal",
    conductive: true,
    description: "A labeled termination point for external readout hardware.",
    consideration:
      "Pinout, mating part, strain relief and contact method must be specified separately.",
  },
];
export const findCircuitProfile = (id: string) =>
  circuitLibrary.find((m) => m.id === id);
