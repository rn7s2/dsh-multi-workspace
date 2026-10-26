/**
 * Locale namespace of the native picker prompt. The Client plugin registers
 * these dictionaries and binds the prompt shown inside the macOS panel.
 *
 * @module dsh-multi-workspace/client/locale
 */

/** Locale namespace key. */
export const NS = 'multi-workspace'

/** Chinese copy. */
export const zh: Record<string, string> = {
  'picker.message': '选择文件夹（可多选：选 2 个及以上会创建组合工作区）',
}

/** English copy. */
export const en: Record<string, string> = {
  'picker.message': 'Choose folders (select 2 or more to create a combined workspace)',
}
