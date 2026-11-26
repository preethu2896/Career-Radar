import{describe,it,expect}from'vitest';
import{companyLogoUrl}from'../src/services/companyLogos.js';
describe('identity-scoped company logos',()=>{
 it('does not assign a known logo to an unrelated company sharing its name',()=>{expect(companyLogoUrl('Aleph','unrelated-company')).toBeNull();});
 it('uses a validated local asset supplied for the exact company record',()=>{expect(companyLogoUrl('Aleph','different-aleph','/company-logos/imported/123abc.png')).toBe('/company-logos/imported/123abc.png');});
 it('rejects external image and path traversal sources',()=>{for(const url of ['https://untrusted.example/logo.png','/company-logos/../private.png','data:image/png;base64,abc'])expect(companyLogoUrl('Aleph','unknown-company',url)).toBeNull();});
 it('retains the existing normalized name lookup for legacy records without IDs',()=>{expect(companyLogoUrl('  RAZORPAY ')).toBe('/company-logos/razorpay.png');});
});
