import type { MotionClip } from "../types";
import { UPPER_BODY_SUBSET_UNVERIFIED } from "../retarget/smplx";
import {
  MotionNotFoundError,
  type MotionEntry,
  type MotionProvider,
} from "./MotionProvider";

/**
 * Motion from the SignSparK sign-language-production model.
 *
 * SignSparK is real, and this is what is actually true about it as of this
 * writing - stated here because the gap between "the paper exists" and "we can
 * use it" is where a project like this quietly goes wrong:
 *
 *   Paper : "SignSparK: Efficient Multilingual Sign Language Production via
 *            Sparse Keyframe Learning" - Low, Symeonidis-Herzig, Ivashechkin,
 *            Mercanoglu Sincan, Bowden (Surrey CVSSP). arXiv 2603.10446
 *   Code  : https://github.com/JianHe0628/SignSparK  (Apache 2.0)
 *   Weights: Hugging Face LionelLow/SignSparK - NON-COMMERCIAL RESEARCH ONLY
 *   Stack : Python 3.10, PyTorch 2.10, CUDA 12.8
 *   Input : spoken text (+ sparse keyframes); a gloss-retrieval path also exists
 *   Output: SMPL-X upper body + MANO hands + FLAME face, written as .npy dicts
 *   Langs : ASL, BSL, CSL, DGS
 *
 * Three things follow from that, and all three block use today:
 *
 * 1. IT CANNOT RUN IN THE BROWSER. It is a CUDA PyTorch model. It has to run as
 *    a separate Python service on a GPU host; there is no npm package and no
 *    JavaScript port. This class therefore talks HTTP to a service YOU run - it
 *    does not pretend to run the model itself.
 *
 * 2. AUSLAN IS NOT ONE OF ITS LANGUAGES. It covers ASL, BSL, CSL and DGS. BSL is
 *    the closest relative - Auslan and BSL share the BANZSL lineage and a
 *    two-handed fingerspelling system - but they are distinct languages with
 *    substantially different vocabulary. BSL output is NOT Auslan and must not be
 *    presented as such. Using this for Auslan needs either Auslan training data
 *    and a fine-tune, or it stays a research reference only.
 *
 * 3. THE OUTPUT NEEDS RETARGETING. SMPL-X/MANO parameters are not named bone
 *    rotations for our rig. See retarget/smplx.ts. The body-joint subset it emits
 *    is not documented precisely enough to map blind, which is why this provider
 *    refuses to run while UPPER_BODY_SUBSET_UNVERIFIED is set.
 *
 * Until a service exists and the mapping is confirmed against real output, this
 * provider is disabled and throws a clear explanation. The animation library
 * remains the working path.
 */
export interface SignSparKConfig {
  /**
   * URL of a Python service you host that wraps SignSparK's sample.py and
   * returns retargetable motion. Nothing is called if this is unset.
   */
  endpoint?: string;
  /** Which sign language the hosted checkpoint was trained on. */
  language?: "ASL" | "BSL" | "CSL" | "DGS";
  /** Must be set deliberately - guards against accidentally enabling an unverified path. */
  enabled?: boolean;
}

export class SignSparKProvider implements MotionProvider {
  readonly name = "signspark";

  constructor(private readonly config: SignSparKConfig = {}) {}

  /** Why this provider cannot serve motion right now, or null if it can. */
  blockedReason(): string | null {
    if (!this.config.enabled) {
      return "SignSparK provider is not enabled. It needs a self-hosted GPU service - see the notes in SignSparKProvider.ts.";
    }
    if (!this.config.endpoint) {
      return "SignSparK provider has no endpoint. Run the model from https://github.com/JianHe0628/SignSparK behind an HTTP service and set endpoint.";
    }
    if (UPPER_BODY_SUBSET_UNVERIFIED) {
      return "SignSparK output cannot be retargeted yet: the SMPL-X upper-body joint subset has not been confirmed against real checkpoint output. Mapping it blind would animate the wrong joints.";
    }
    if (this.config.language && this.config.language !== "BSL") {
      return `Configured checkpoint is ${this.config.language}, which is unrelated to Auslan.`;
    }
    return null;
  }

  async getMotion(sign: string): Promise<MotionClip> {
    const blocked = this.blockedReason();
    if (blocked) throw new Error(blocked);

    // Reached only once a service exists AND the joint mapping is verified.
    // Deliberately left unimplemented rather than filled with a plausible-looking
    // fetch + retarget that has never been run against real output.
    throw new MotionNotFoundError(sign);
  }

  async list(): Promise<MotionEntry[]> {
    return [];
  }
}
