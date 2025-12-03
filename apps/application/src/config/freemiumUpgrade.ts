export const FREEMIUM_UPGRADE_CONFIG = {
 // switch ON/OFF - si está en false, el popup NO se mostrará NUNCA
  isEnabled: true,
  
 // espera mínima desde que el usuario se registró
  // showAfterDays: 1 → el usuario debe estar registrado al menos 1 día
  showAfterDays: 1,
  
 // días mínimos entre apariciones del popup
  frequencyDays: 3,
  
 // claves de almacenamiento para persistencia
  storageKeys: {
    lastShown: "ialex-freemium-last-shown",
    impressions: "ialex-freemium-impressions",
  },
  
   // Límite total de veces que se puede mostrar al usuario
  // maxImpressions: 10 → Después de 10 veces, nunca más se muestra
  maxImpressions: 10,
};
