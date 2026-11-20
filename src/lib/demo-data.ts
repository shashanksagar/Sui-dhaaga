import { measurementFields } from "./validation.ts";
export const cities = ["Mumbai", "Delhi", "Bengaluru", "Jaipur", "Kolkata"] as const;
export const tailors = [
  { id: "tailor-amara", city: "Mumbai", expertise: ["Dresses", "Embroidery"], bio: "Thoughtful silhouettes and fine hand-finished details for memorable occasions.", basePrice: 120000, estimatedDays: 12, garmentType: "Dress", image: "/images/atelier-1.svg" },
  { id: "tailor-luca", city: "Delhi", expertise: ["Suits", "Formalwear"], bio: "Precise modern tailoring with a focus on fit, structure, and lasting comfort.", basePrice: 240000, estimatedDays: 18, garmentType: "Suit", image: "/images/atelier-2.svg" },
  { id: "tailor-meera", city: "Jaipur", expertise: ["Bridal", "Embroidery"], bio: "Artful bridal pieces with considered handwork and thoughtful finishing.", basePrice: 180000, estimatedDays: 15, garmentType: "Lehenga", image: "/images/atelier-3.svg" },
  { id: "tailor-june", city: "Bengaluru", expertise: ["Casualwear", "Dresses"], bio: "Relaxed everyday shapes, carefully cut and made for easy movement.", basePrice: 95000, estimatedDays: 10, garmentType: "Shirt", image: "/images/atelier-4.svg" },
  { id: "tailor-noor", city: "Kolkata", expertise: ["Traditional wear", "Womenswear"], bio: "Traditional craftsmanship interpreted for expressive contemporary dressing.", basePrice: 160000, estimatedDays: 14, garmentType: "Traditional wear", image: "/images/atelier-5.svg" },
];
export const measurementFieldsByGarment: Record<string, string[]> = {
  Dress: ["bust", "waist", "hip", "shoulder", "length"], Suit: ["chest", "waist", "shoulder", "sleeve", "length"],
  Shirt: ["chest", "neck", "shoulder", "sleeve", "length"], Trousers: ["waist", "hip", "inseam", "length"],
  "Traditional wear": ["chest", "waist", "hip", "shoulder", "length"], Blouse: ["bust", "waist", "shoulder", "sleeve"],
  Kurta: ["chest", "waist", "shoulder", "sleeve", "length"], Lehenga: ["waist", "hip", "length"],
};
export function catalogFor(t: typeof tailors[number]) {
  return [{ garmentType: t.garmentType, basePrice: t.basePrice, estimatedDays: t.estimatedDays, requiredMeasurements: measurementFieldsByGarment[t.garmentType] ?? [...measurementFields] }];
}
export function workshopAddress(t: typeof tailors[number]) {
  return { name: "Workshop", line1: "Private workshop address", city: t.city, postalCode: "400001", country: "India", phone: "0000000000" };
}
