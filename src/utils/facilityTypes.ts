// Utility function to translate facility types from English to Romanian
export const getFacilityTypeLabel = (facilityType: string): string => {
  const facilityTypeLabels: Record<string, string> = {
    'tennis': 'Tenis',
    'football': 'Fotbal',
    'padel': 'Padel',
    'squash': 'Squash',
    'basketball': 'Baschet',
    'volleyball': 'Volei',
    'ping_pong': 'Ping Pong',
    'foot_tennis': 'Tenis de Picior'
  };

  return facilityTypeLabels[facilityType] || facilityType;
};

// Array of facility types with Romanian labels for dropdowns and filters
export const facilityTypeOptions = [
  { value: "tennis", label: "Tenis" },
  { value: "football", label: "Fotbal" },
  { value: "padel", label: "Padel" },
  { value: "squash", label: "Squash" },
  { value: "basketball", label: "Baschet" },
  { value: "volleyball", label: "Volei" },
  { value: "ping_pong", label: "Ping Pong" },
  { value: "foot_tennis", label: "Tenis de Picior" }
];