import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { exec, parse_route_id, resolve_entry } from './routing.js';

const tests = {
	'/': {
		pattern: /^\/$/,
		params: []
	},
	'/blog': {
		pattern: /^\/blog\/?$/,
		params: []
	},
	'/blog.json': {
		pattern: /^\/blog\.json\/?$/,
		params: []
	},
	'/blog/[slug]': {
		pattern: /^\/blog\/([^/]+?)\/?$/,
		params: [{ name: 'slug', matcher: undefined, optional: false, rest: false, chained: false }]
	},
	'/blog/[slug].json': {
		pattern: /^\/blog\/([^/]+?)\.json\/?$/,
		params: [{ name: 'slug', matcher: undefined, optional: false, rest: false, chained: false }]
	},
	'/blog/[[slug]]': {
		pattern: /^\/blog(?:\/([^/]+))?\/?$/,
		params: [{ name: 'slug', matcher: undefined, optional: true, rest: false, chained: true }]
	},
	'/blog/[[slug=type]]/sub': {
		pattern: /^\/blog(?:\/([^/]+))?\/sub\/?$/,
		params: [{ name: 'slug', matcher: 'type', optional: true, rest: false, chained: true }]
	},
	'/blog/[[slug]].json': {
		pattern: /^\/blog\/([^/]*)?\.json\/?$/,
		params: [{ name: 'slug', matcher: undefined, optional: true, rest: false, chained: false }]
	},
	'/[...catchall]': {
		pattern: /^(?:\/(.*))?\/?$/,
		params: [{ name: 'catchall', matcher: undefined, optional: false, rest: true, chained: true }]
	},
	'/foo/[...catchall]/bar': {
		pattern: /^\/foo(?:\/(.*))?\/bar\/?$/,
		params: [{ name: 'catchall', matcher: undefined, optional: false, rest: true, chained: true }]
	},
	'/matched/[id=uuid]': {
		pattern: /^\/matched\/([^/]+?)\/?$/,
		params: [{ name: 'id', matcher: 'uuid', optional: false, rest: false, chained: false }]
	},
	'/@-symbol/[id]': {
		pattern: /^\/@-symbol\/([^/]+?)\/?$/,
		params: [{ name: 'id', matcher: undefined, optional: false, rest: false, chained: false }]
	}
};

for (const [key, expected] of Object.entries(tests)) {
	test(`parse_route_id: "${key}"`, () => {
		const actual = parse_route_id(key);

		assert.equal(actual.pattern.toString(), expected.pattern.toString());
		assert.equal(actual.params, expected.params);
	});
}

const exec_tests = [
	{
		route: '/blog/[[slug]]/sub[[param]]',
		path: '/blog/sub',
		expected: {}
	},
	{
		route: '/blog/[[slug]]/sub[[param]]',
		path: '/blog/slug/sub',
		expected: { slug: 'slug' }
	},
	{
		route: '/blog/[[slug]]/sub[[param]]',
		path: '/blog/slug/subparam',
		expected: { slug: 'slug', param: 'param' }
	},
	{
		route: '/blog/[[slug]]/sub[[param]]',
		path: '/blog/subparam',
		expected: { param: 'param' }
	},
	{
		route: '/[[slug]]/[...rest]',
		path: '/slug/rest/sub',
		expected: { slug: 'slug', rest: 'rest/sub' }
	},
	{
		route: '/[[slug]]/[...rest]',
		path: '/slug/rest',
		expected: { slug: 'slug', rest: 'rest' }
	},
	{
		route: '/[[slug]]/[...rest]',
		path: '/slug',
		expected: { slug: 'slug', rest: '' }
	},
	{
		route: '/[[slug]]/[...rest]',
		path: '/',
		expected: { rest: '' }
	},
	{
		route: '/[...rest]/path',
		path: '/rest/path',
		expected: { rest: 'rest' }
	},
	{
		route: '/[[slug1]]/[[slug2]]',
		path: '/slug1/slug2',
		expected: { slug1: 'slug1', slug2: 'slug2' }
	},
	{
		route: '/[[slug1]]/[[slug2]]',
		path: '/slug1',
		expected: { slug1: 'slug1' }
	},
	{
		route: '/[[slug1=matches]]',
		path: '/',
		expected: {}
	},
	{
		route: '/[[slug1=doesntmatch]]',
		path: '/',
		expected: {}
	},
	{
		route: '/[[slug1=matches]]/[[slug2=doesntmatch]]',
		path: '/foo',
		expected: { slug1: 'foo' }
	},
	{
		route: '/[[slug1=doesntmatch]]/[[slug2=doesntmatch]]',
		path: '/foo',
		expected: undefined
	},
	{
		route: '/[...slug1=matches]',
		path: '/',
		expected: { slug1: '' }
	},
	{
		route: '/[...slug1=doesntmatch]',
		path: '/',
		expected: undefined
	},
	{
		route: '/[[slug=doesntmatch]]/[...rest]',
		path: '/foo',
		expected: { rest: 'foo' }
	},
	{
		route: '/[[slug1=doesntmatch]]/[slug2]/[...rest]',
		path: '/foo/bar/baz',
		expected: { slug2: 'foo', rest: 'bar/baz' }
	},
	{
		route: '/[[slug1=doesntmatch]]/[slug2]/[...rest]/baz',
		path: '/foo/bar/baz',
		expected: { slug2: 'foo', rest: 'bar' }
	},
	{
		route: '/[[a=doesntmatch]]/[[b=doesntmatch]]/[[c=doesntmatch]]/[...d]',
		path: '/a/b/c/d',
		expected: { d: 'a/b/c/d' }
	},
	{
		route: '/[[a=doesntmatch]]/[b]/[...c]/[d]/e',
		path: '/foo/bar/baz/qux/e',
		expected: { b: 'foo', c: 'bar/baz', d: 'qux' }
	},
	{
		route: '/[[slug1=doesntmatch]]/[[slug2=doesntmatch]]/[...rest]',
		path: '/foo/bar/baz',
		expected: { rest: 'foo/bar/baz' }
	},
	{
		route: '/[[slug1=doesntmatch]]/[[slug2=matches]]/[[slug3=doesntmatch]]/[...rest].json',
		path: '/foo/bar/baz.json',
		expected: { slug2: 'foo', rest: 'bar/baz' }
	},
	{
		route: '/[[a=doesntmatch]]/[[b=matches]]/c',
		path: '/a/b/c',
		expected: undefined
	},
	{
		route: '/[[slug1=matches]]/[[slug2=matches]]/constant/[[slug3=matches]]',
		path: '/a/b/constant/c',
		expected: { slug1: 'a', slug2: 'b', slug3: 'c' }
	},
	{
		route: '/[[slug1=doesntmatch]]/[[slug2=matches]]/constant/[[slug3=matches]]',
		path: '/b/constant/c',
		expected: { slug2: 'b', slug3: 'c' }
	},
	{
		route: '/[[slug1=doesntmatch]]/[slug2=matches]/[slug3]',
		path: '/a/b/c',
		expected: undefined
	}
];

for (const { path, route, expected } of exec_tests) {
	test(`exec extracts params correctly for ${path} from ${route}`, () => {
		const { pattern, params } = parse_route_id(route);
		const match = pattern.exec(path);
		if (!match) throw new Error(`Failed to match ${path}`);
		const actual = exec(match, params, {
			matches: () => true,
			doesntmatch: () => false
		});
		assert.equal(actual, expected);
	});
}

test('parse_route_id errors on bad param name', () => {
	assert.throws(() => parse_route_id('abc/[b-c]'), /Invalid param: b-c/);
	assert.throws(() => parse_route_id('abc/[bc=d-e]'), /Invalid param: bc=d-e/);
});

const from_entry_tests = [
	{
		route: '/blog/[one]/[two]',
		entry: { one: 'one', two: 'two' },
		expected: '/blog/one/two'
	},
	{
		route: '/blog/[one=matcher]/[...two]',
		entry: { one: 'one', two: 'two/three' },
		expected: '/blog/one/two/three'
	},
	{
		route: '/blog/[one=matcher]/[[two]]',
		entry: { one: 'one' },
		expected: '/blog/one'
	}
];

for (const { route, entry, expected } of from_entry_tests) {
	test(`resolve_entry generates correct path for ${route}`, () => {
		const result = resolve_entry(route, entry);
		assert.equal(result, expected);
	});
}

test('resolve_entry errors on missing entry for required param', () => {
	assert.throws(
		() => resolve_entry('/blog/[one]/[two]', { one: 'one' }),
		"Missing param 'two' in route /blog/[one]/[two]"
	);
});

test('resolve_entry errors on entry values starting or ending with slashes', () => {
	assert.throws(
		() => resolve_entry('/blog/[one]/[two]', { one: 'one', two: '/two' }),
		"Parameter 'two' in route /blog/[one]/[two] cannot start or end with a slash -- this would cause an invalid route like foo//bar"
	);
	assert.throws(
		() => resolve_entry('/blog/[one]/[two]', { one: 'one', two: 'two/' }),
		"Parameter 'two' in route /blog/[one]/[two] cannot start or end with a slash -- this would cause an invalid route like foo//bar"
	);
});

test.run();
