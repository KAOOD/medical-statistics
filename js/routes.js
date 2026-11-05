// Resolves all paths relative to the repository root; works in GitHub Pages subpaths.
const root = new URL('../', import.meta.url);
const pages = Object.freeze({index:'index.html',login:'pages/login.html',dashboard:'pages/dashboard.html',specialties:'pages/specialties.html',doctors:'pages/doctors.html','doctor-details':'pages/doctor-details.html',admin:'pages/admin.html'});
export function urlFor(name){if(!Object.hasOwn(pages,name))throw new Error('Unknown route');return new URL(pages[name],root).href;}
export function componentUrl(filename){if(!['header','sidebar','footer'].includes(filename))throw new Error('Invalid component');return new URL('components/'+filename+'.html',root).href;}
export function navigate(name){location.replace(urlFor(name));}
