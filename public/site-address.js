// Display only the homepage host, never saved results, paths, or tracking data.
export function homeLabel(href){return new URL(href).host;}
