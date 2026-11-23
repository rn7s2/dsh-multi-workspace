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
  'dialog.alreadyMember': '已在工作区中',
  'menu.add': '添加文件夹…',
  'menu.remove': '移除文件夹…',
  'manage.pickMessage': '选择要添加到此工作区的文件夹（可多选）',
  'manage.add.title': '添加文件夹',
  'manage.add.heading': '向“{name}”添加文件夹',
  'manage.add.subtitle': '选中的文件夹会以符号链接加入；不会移动或复制它们的内容。',
  'manage.add.confirm': '添加',
  'manage.add.pending': '正在添加…',
  'manage.remove.heading': '从“{name}”移除文件夹',
  'manage.remove.inUseTag': '有会话正在使用',
  'manage.remove.inUseWarning': '有正在运行的会话在这些文件夹中工作：{names}。移除后它们的将会立即失效。',
  'manage.retry': '重试',
  'manage.remove.subtitle': '只移除链接，磁盘上的文件夹保持原样。',
  'manage.remove.confirm': '移除',
  'manage.remove.pending': '正在移除…',
  'manage.remove.minimum': '一个组合工作区至少保留 {count} 个文件夹。',
  'manage.cancel': '取消',
  'manage.close': '关闭',
  'manage.failed': '操作失败，请重试。',
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
  'dialog.alreadyMember': 'already in workspace',
  'menu.add': 'Add folders…',
  'menu.remove': 'Remove folders…',
  'manage.pickMessage': 'Choose folders to add to this workspace (multiple selection)',
  'manage.add.title': 'Add folders',
  'manage.add.heading': 'Add folders to “{name}”',
  'manage.add.subtitle': 'Picked folders join as symlinks; nothing is moved or copied.',
  'manage.add.confirm': 'Add',
  'manage.add.pending': 'Adding…',
  'manage.remove.heading': 'Remove folders from “{name}”',
  'manage.remove.inUseTag': 'in use by a session',
  'manage.remove.inUseWarning': 'Running sessions are working in: {names}. Removing these folders breaks them immediately.',
  'manage.retry': 'Try again',
  'manage.remove.subtitle': 'Only the links go; the folders on disk stay untouched.',
  'manage.remove.confirm': 'Remove',
  'manage.remove.pending': 'Removing…',
  'manage.remove.minimum': 'A combined workspace keeps at least {count} folders.',
  'manage.cancel': 'Cancel',
  'manage.close': 'Close',
  'manage.failed': 'That did not work. Please try again.',
}
