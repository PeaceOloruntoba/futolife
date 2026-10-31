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

type InventoryLocation = CampusLocation & {
  world?: { x?: number | null; z?: number | null; status?: string } | null;
};

export const locations = (inventory.locations as InventoryLocation[])
  .filter((item) => item.name)
  .map(({ world, ...place }) => ({
    ...place,
    local_x: place.local_x ?? world?.x ?? null,
    local_z: place.local_z ?? world?.z ?? null,
    position_status: place.position_status ?? (world ? "provisional" : "unverified"),
  }));
