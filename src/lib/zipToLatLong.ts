import axios from "axios";

export async function zipToLatLong(zip: string): Promise<{ lat: number; lng: number }> {
  const res = await axios.get(`https://api.zippopotam.us/us/${zip}`);
  const place = res.data.places[0];
  return {
    lat: parseFloat(place.latitude),
    lng: parseFloat(place.longitude),
  };
}
