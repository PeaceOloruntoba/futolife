import inventory from "../../public/campus/locations.json";

export type CampusLocation = {
  id: string;
  name: string;
  category: string;
  verification?: string;
  implementation?: string;
  notes?: string;
  description?: string | null;
  position_status?: "verified" | "provisional" | "unverified";
  latitude?: number | null;
  longitude?: number | null;
  local_x?: number | null;
  local_z?: number | null;
};

export const locations = (inventory.locations as CampusLocation[]).filter((item) => item.name);
