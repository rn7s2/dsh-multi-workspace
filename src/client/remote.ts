/**
 * Client-side Typert Remote contribution for the `multiWorkspace` namespace.
 * Mounted by `src/client/index.ts` through `ctx.remote.$mount()`.
 *
 * @module dsh-multi-workspace/client/remote
 */
import { z } from 'zod'
import { createTypertRemoteInfo } from '../shared/remote-info.js'
import { buildRemoteSpec } from '../shared/remote-spec.js'

/** The mountable contribution; `ctx.remote.$mount()` validates and installs it. */
export const TYPERT_REMOTE = createTypertRemoteInfo(buildRemoteSpec(), z)

export default TYPERT_REMOTE
