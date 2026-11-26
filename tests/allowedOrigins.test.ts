import{expect,it}from'vitest';
import{allowedOrigins}from'../supabase/functions/_shared/allowedOrigins.js';
it('extends existing trusted origins without replacing them or allowing other Vercel projects',()=>{const local='http://localhost:5173',mobile='http://192.168.1.8:5173',live='https://career-radar-eta.vercel.app';const origins=allowedOrigins(local+','+mobile,' '+live+','+local);expect(origins).toEqual([local,mobile,live]);expect(origins.includes('https://another-project.vercel.app')).toBe(false);expect(origins.includes(live+'.attacker.example')).toBe(false);});
it('handles an unset optional deployment-origin value',()=>{expect(allowedOrigins('http://localhost:5173',undefined)).toEqual(['http://localhost:5173']);expect(allowedOrigins(undefined,' , ')).toEqual([]);});
