// Utility function to translate facility types from English to Romanian
export const getFacilityTypeLabel = (facilityType: string): string => {
  const facilityTypeLabels: Record<string, string> = {
    'tennis': 'Tenis',
    'football': 'Fotbal',
    'padel': 'Padel',
    'swimming': 'Înot',
    'basketball': 'Baschet',
    'volleyball': 'Volei'
  };

  return facilityTypeLabels[facilityType] || facilityType;
};

// Array of facility types with Romanian labels for dropdowns and filters
export const facilityTypeOptions = [
  { value: "tennis", label: "Tenis" },
  { value: "football", label: "Fotbal" },
  { value: "padel", label: "Padel" },
  { value: "swimming", label: "Înot" },
  { value: "basketball", label: "Baschet" },
  { value: "volleyball", label: "Volei" }
];