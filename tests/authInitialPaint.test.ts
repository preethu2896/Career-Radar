import {afterEach,expect,it,vi} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AuthRoute} from '../src/ui/AuthFlows.js';
afterEach(()=>vi.unstubAllGlobals());
it('renders a skeleton instead of a login or signup form before the existing session has been checked',()=>{
 vi.stubGlobal('window',{location:{search:''}});
 for(const path of ['/login','/signup']){
  const html=renderToStaticMarkup(createElement(AuthRoute,{path,navigate:()=>{}}));
  expect(html).toContain('Checking your sign-in');expect(html).not.toContain('name="password"');expect(html).not.toContain('name="email"');
 }
});
