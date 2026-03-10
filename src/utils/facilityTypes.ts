export const getFacilityTypeLabel = (facilityType: string): string => {
  const labels: Record<string, string> = {
    'football': 'Fotbal',
    'tennis': 'Tenis',
    'padel': 'Padel',
    'squash': 'Squash',
    'basketball': 'Baschet',
    'volleyball': 'Volei',
    'foot_tennis': 'Tenis de Picior',
    'ping_pong': 'Ping Pong'
  };
  return labels[facilityType] || facilityType;
};

export const facilityTypeOptions = [
  { value: "football", label: "Fotbal" },
  { value: "tennis", label: "Tenis" },
  { value: "padel", label: "Padel" },
  { value: "squash", label: "Squash" },
  { value: "basketball", label: "Baschet" },
  { value: "volleyball", label: "Volei" },
  { value: "foot_tennis", label: "Tenis de Picior" },
  { value: "ping_pong", label: "Ping Pong" }
];