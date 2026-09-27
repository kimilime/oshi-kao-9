export const provinces = ['北京市','天津市','河北省','山西省','内蒙古自治区','辽宁省','吉林省','黑龙江省','上海市','江苏省','浙江省','安徽省','福建省','江西省','山东省','河南省','湖北省','湖南省','广东省','广西壮族自治区','海南省','重庆市','四川省','贵州省','云南省','西藏自治区','陕西省','甘肃省','青海省','宁夏回族自治区','新疆维吾尔自治区'];
const aliases = Object.fromEntries(provinces.map(p=>[p.replace(/省$|市$|壮族自治区$|回族自治区$|维吾尔自治区$|自治区$/g,''),p]));
Object.assign(aliases,{广州:'广东省',广州市:'广东省',成都:'四川省',成都市:'四川省'});
export function memberRegion(member){const value=(member.province ?? member.city)?.trim();return aliases[value] || value || '未填写';}

export function memberRegions(member){return [...new Set((Array.isArray(member.provinces)&&member.provinces.length?member.provinces:[member.province ?? member.city]).map(province=>memberRegion({province})))];}
export function memberGroups(member){return (Array.isArray(member.groups)&&member.groups.length?member.groups:[member.group]).filter(g=>typeof g==='string'&&g.trim());}
