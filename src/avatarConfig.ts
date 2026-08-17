/**
 * Where the rigged human lives.
 *
 * Drop a GLB at `public/models/avatar.glb` and the app picks it up on reload -
 * no code change. Until then it renders the placeholder figure.
 */
export const AVATAR_URL = "/models/avatar.glb";

/** Every rigged model is exported at a different scale - normalise to this height (metres). */
export const TARGET_HEIGHT = 1.75;
