/**
 * Locale dictionaries of the plugin's Client surfaces: the native panel
 * prompt and the in-app multi-folder browser.
 *
 * @module dsh-multi-workspace/client/locale
 */

/** Locale namespace key. */
export const NS = 'multi-workspace'

/** Chinese copy. */
export const zh: Record<string, string> = {
  'picker.message': '选择文件夹（可多选：选 2 个及以上会创建组合工作区）',
  'dialog.title': '选择文件夹',
  'dialog.subtitle': '选 1 个文件夹会直接打开；选 2 个及以上会创建一个组合工作区。',
  'dialog.home': '主目录',
  'dialog.root': '根目录',
  'dialog.loading': '正在读取…',
  'dialog.empty': '这里没有子文件夹',
  'dialog.hidden': '显示隐藏文件夹',
  'dialog.hiddenTag': '隐藏',
  'dialog.refresh': '刷新',
  'dialog.truncated': '文件夹过多，只显示前一部分。',
  'dialog.selected': '已选 {count} 个',
  'dialog.remove': '移除 {name}',
  'dialog.max': '最多选择 64 个文件夹。',
  'dialog.cancel': '取消',
  'dialog.open': '打开此文件夹',
  'dialog.create': '创建组合工作区',
  'dialog.creating': '正在创建…',
}

/** English copy. */
export const en: Record<string, string> = {
  'picker.message': 'Choose folders (select 2 or more to create a combined workspace)',
  'dialog.title': 'Choose folders',
  'dialog.subtitle':
    'One folder opens directly; two or more folders become one combined workspace.',
  'dialog.home': 'Home',
  'dialog.root': 'Root',
  'dialog.loading': 'Reading…',
  'dialog.empty': 'No subfolders here',
  'dialog.hidden': 'Show hidden folders',
  'dialog.hiddenTag': 'hidden',
  'dialog.refresh': 'Refresh',
  'dialog.truncated': 'Too many folders; only the beginning is shown.',
  'dialog.selected': '{count} selected',
  'dialog.remove': 'Remove {name}',
  'dialog.max': 'At most 64 folders can be selected.',
  'dialog.cancel': 'Cancel',
  'dialog.open': 'Open this folder',
  'dialog.create': 'Create combined workspace',
  'dialog.creating': 'Creating…',
}
