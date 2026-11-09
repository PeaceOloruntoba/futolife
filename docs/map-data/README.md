# FUTO campus map data, road draft v0.2

This app-side data file is derived from the owner-authorized UPDATED FUTO MASTER PLAN image and the v0.2 provisional road traces. It preserves the original image-pixel coordinates in its transform metadata and stores a separate local-world conversion for the prototype.

The source figure, 90-entry transcribed legend, Phase 1 POI table, original pixel traces and SVG overlay are retained beside this note for review and further digitizing. The 90 legend names are historical/transcribed labels; presence in the source does not confirm a current building or official name.

## Coordinate and confidence rules

- The plan image is not georeferenced. The current local origin is provisionally placed at the northwest start of road trace R01; the assumption that this corresponds to the Main Gate must be confirmed before the point is presented as a real-world navigation origin.
- `metres_per_pixel` is a visual scale estimate for gameplay and is not survey scale. The resulting line widths are visual estimates.
- Every road remains `provisional_trace`. None of these coordinates are latitude/longitude, GPS data, a survey, or safe routing instructions.
- Candidate places have no geometry. The seven ESIA solar project beacons are excluded because they describe only the separate 11.150 ha solar project site.

The Three.js scene may use these provisional lines for an explicitly labeled exploratory prototype. Publishing navigation, building footprints, or verified POI positions still requires control points and field review.
