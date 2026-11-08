/**
 * Locale binding face shared by the flow and the dialog.
 *
 * @module dsh-multi-workspace/client/translate
 */

/** Bound translation function of this plugin's locale namespace. */
export type Translate = (key: string, params?: Record<string, string | number>) => string
