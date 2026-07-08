import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildApiDirectoryTree,
  countDirectoryTreeRequestNodes,
  collectCollapsedDirectoryKeys,
  collectExpandableDirectoryKeys,
  definitionModuleLoadKey,
  filterApiDirectoryTree,
  findDirectoryNodeByKey,
} from '../src/widgets/api-interface-workspace/lib/apiDirectoryTree.ts'

const workspace = {
  code: 'XMAN',
  workspaceCode: 'XMAN',
  name: 'X-MAN',
  workspaceName: 'X-MAN',
}

const moduleNode = {
  id: 33,
  workspaceCode: 'XMAN',
  name: '订单',
  fullPath: '企微侧边栏/订单',
  definitionCount: 2,
  children: [],
}

test('buildApiDirectoryTree keeps unloaded leaf modules expandable with placeholder', () => {
  const tree = buildApiDirectoryTree({
    workspaceCode: 'XMAN',
    workspaces: [workspace],
    modules: [moduleNode],
    definitions: [],
    loadedModuleKeys: new Set(),
    loadingModuleKeys: new Set(),
  })

  const leaf = tree[0].children[0].children[0].children[0]

  assert.equal(leaf.label, '订单')
  assert.equal(leaf.count, 2)
  assert.equal(leaf.children.length, 1)
  assert.equal(leaf.children[0].type, 'placeholder')
  assert.equal(leaf.children[0].label, '')
})

test('buildApiDirectoryTree shows loading placeholder before request rows while module is loading', () => {
  const key = definitionModuleLoadKey('XMAN', 33, '企微侧边栏/订单')
  const tree = buildApiDirectoryTree({
    workspaceCode: 'XMAN',
    workspaces: [workspace],
    modules: [moduleNode],
    definitions: [],
    loadedModuleKeys: new Set(),
    loadingModuleKeys: new Set([key]),
  })

  const leaf = tree[0].children[0].children[0].children[0]

  assert.equal(leaf.children[0].type, 'placeholder')
  assert.equal(leaf.children[0].label, '加载接口中...')
  assert.equal(leaf.children[0].loading, true)
})

test('buildApiDirectoryTree renders loaded requests under their module', () => {
  const key = definitionModuleLoadKey('XMAN', 33, '企微侧边栏/订单')
  const definition = {
    id: 1001,
    workspaceCode: 'XMAN',
    name: '创建订单',
    method: 'POST',
    directoryName: '企微侧边栏/订单',
  }
  const tree = buildApiDirectoryTree({
    workspaceCode: 'XMAN',
    workspaces: [workspace],
    modules: [moduleNode],
    definitions: [definition],
    loadedModuleKeys: new Set([key]),
    loadingModuleKeys: new Set(),
  })

  const leaf = tree[0].children[0].children[0].children[0]

  assert.equal(leaf.children.length, 1)
  assert.equal(leaf.children[0].type, 'request')
  assert.equal(leaf.children[0].label, '创建订单')
  assert.equal(leaf.children[0].definition, definition)
})

test('buildApiDirectoryTree adds load-more placeholder when module has more requests to page in', () => {
  const key = definitionModuleLoadKey('XMAN', 33, moduleNode.fullPath)
  const definition = {
    id: 1001,
    workspaceCode: 'XMAN',
    name: '��������',
    method: 'POST',
    directoryName: moduleNode.fullPath,
  }
  const tree = buildApiDirectoryTree({
    workspaceCode: 'XMAN',
    workspaces: [workspace],
    modules: [moduleNode],
    definitions: [definition],
    loadedModuleKeys: new Set([key]),
    loadingModuleKeys: new Set(),
    moduleRequestStateByKey: new Map([[key, {
      loadedCount: 1,
      total: 3,
      hasMore: true,
    }]]),
  })

  const leaf = findDirectoryNodeByKey(tree, 'module:XMAN:33')

  assert.equal(leaf?.children.length, 2)
  assert.equal(leaf?.children[1].type, 'placeholder')
  assert.equal(leaf?.children[1].placeholderAction, 'load-more')
  assert.equal(leaf?.children[1].parentKey, 'module:XMAN:33')
})

test('buildApiDirectoryTree trims rendered requests and adds show-more placeholder for large loaded module', () => {
  const key = definitionModuleLoadKey('XMAN', 33, moduleNode.fullPath)
  const definitions = [
    {
      id: 1001,
      workspaceCode: 'XMAN',
      name: '创建订单',
      method: 'POST',
      directoryName: moduleNode.fullPath,
    },
    {
      id: 1002,
      workspaceCode: 'XMAN',
      name: '更新订单',
      method: 'PUT',
      directoryName: moduleNode.fullPath,
    },
    {
      id: 1003,
      workspaceCode: 'XMAN',
      name: '查询订单',
      method: 'GET',
      directoryName: moduleNode.fullPath,
    },
  ]
  const tree = buildApiDirectoryTree({
    workspaceCode: 'XMAN',
    workspaces: [workspace],
    modules: [moduleNode],
    definitions,
    loadedModuleKeys: new Set([key]),
    loadingModuleKeys: new Set(),
    moduleVisibleRequestCountByKey: new Map([[key, 2]]),
  })

  const leaf = findDirectoryNodeByKey(tree, 'module:XMAN:33')

  assert.equal(leaf?.count, 3)
  assert.equal(leaf?.children.length, 3)
  assert.equal(leaf?.children[0].type, 'request')
  assert.equal(leaf?.children[1].type, 'request')
  assert.equal(leaf?.children[2].placeholderAction, 'show-more')
  assert.equal(leaf?.children[2].loadedCount, 2)
  assert.equal(leaf?.children[2].totalCount, 3)
})

test('filterApiDirectoryTree keeps matched branches only and counts request nodes', () => {
  const key = definitionModuleLoadKey('XMAN', 33, moduleNode.fullPath)
  const tree = buildApiDirectoryTree({
    workspaceCode: 'XMAN',
    workspaces: [workspace],
    modules: [moduleNode],
    definitions: [{
      id: 1001,
      workspaceCode: 'XMAN',
      name: '��������',
      method: 'POST',
      directoryName: moduleNode.fullPath,
      path: '/orders/create',
    }],
    loadedModuleKeys: new Set([key]),
    loadingModuleKeys: new Set(),
  })

  const filtered = filterApiDirectoryTree(tree[0].children, 'create')

  assert.equal(countDirectoryTreeRequestNodes(filtered), 1)
  assert.equal(findDirectoryNodeByKey(filtered, 'request:1001')?.label, '��������')
})

test('directory tree helpers collect keys and find nested nodes', () => {
  const tree = buildApiDirectoryTree({
    workspaceCode: 'XMAN',
    workspaces: [workspace],
    modules: [moduleNode],
    definitions: [],
    loadedModuleKeys: new Set(),
    loadingModuleKeys: new Set(),
  })

  assert.deepEqual(collectCollapsedDirectoryKeys(tree), ['definition-root', 'workspace:XMAN'])
  assert.equal(collectExpandableDirectoryKeys(tree).includes('module:XMAN:33'), true)
  assert.equal(findDirectoryNodeByKey(tree, 'module:XMAN:33')?.label, '订单')
  assert.equal(findDirectoryNodeByKey(tree, 'missing'), null)
})
