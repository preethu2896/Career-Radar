import {useProtectedAuth} from './AuthFlows.js';
import {DiscoveryRoute} from './Discovery.js';
import {LoadingSkeleton} from './LoadingSkeleton.js';

export function JobsDashboardRoute({navigate}:{navigate:(path:string)=>void}){
  const auth=useProtectedAuth(navigate,'dashboard');
  if(auth.loading)return <main className="cr-loading"><LoadingSkeleton label="Loading your jobs"/></main>;
  if(auth.error)return <main className="cr-loading"><p role="alert">{auth.error}</p><button className="auth-primary" onClick={()=>navigate('/login')}>Sign in again</button></main>;
  if(!auth.userId||!auth.profile)return null;
  return <DiscoveryRoute key={auth.userId} path={window.location.pathname} navigate={navigate}/>;
}
