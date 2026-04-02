export const GRADE_SYSTEMS = {
  V: 'V-Scale',
  FONT: 'Fontainebleau',
}

// All grades stored in the backend use V-scale
export const V_GRADES = ['Unknown','V0','V1','V2','V3','V4','V5','V6','V7','V8','V9','V10','V11','V12','V15','V16','V17']

const V_TO_FONT = {
  Unknown: 'Unknown',
  V0: '4',   V1: '5',   V2: '5+',
  V3: '6A',  V4: '6B',  V5: '6C',
  V6: '7A',  V7: '7A+', V8: '7B+',
  V9: '7C',  V10: '7C+', V11: '8A',
  V12: '8A+', V15: '8B+', V16: '8C+', V17: '9A',
}

// Convert a V-scale grade for display in the given system.
// The underlying stored value is always V-scale.
export function convertGrade(vGrade, system) {
  if (!vGrade) return vGrade
  if (system === 'FONT') return V_TO_FONT[vGrade] ?? vGrade
  return vGrade
}
