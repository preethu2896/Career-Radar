const families = [
 ['Software Engineer', 'Frontend Developer', 'Backend Developer', 'Full-Stack Developer', 'QA Engineer', 'Mobile Developer'],
 ['AI/ML Engineer', 'Data Scientist', 'Data Engineer', 'Data Analyst', 'Business Analyst'],
 ['DevOps Engineer', 'Cloud Engineer', 'Site Reliability Engineer', 'Technical Support Engineer', 'Cybersecurity Engineer'],
 ['Product Designer', 'Graphic Designer', 'Frontend Developer'],
 ['Product Manager', 'Business Analyst', 'Operations Associate'],
 ['Sales Executive', 'Digital Marketing Executive', 'Content Writer', 'Customer Support Associate'],
 ['Accountant', 'Financial Analyst'], ['HR Executive', 'Recruiter', 'Operations Associate']
];
export function suggestRelatedRoles(roles: readonly string[]): string[] {
 const selected = new Set(roles.map(role => role.toLowerCase()));
 return [...new Set(families.filter(group => group.some(role => selected.has(role.toLowerCase()))).flat())]
 .filter(role => !selected.has(role.toLowerCase())).slice(0, 5);
}
