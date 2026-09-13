-- Restore the reporting hierarchy supplied in the employee master dataset.
-- Employee codes are tenant-local, so the join cannot cross tenant boundaries.
with manager_map(employee_code, manager_code) as (
  values
    ('E1002', 'E1001'), ('E1003', 'E1001'), ('E1004', 'E1001'), ('E1005', 'E1002'),
    ('E1006', 'E1004'), ('E1007', 'E1003'), ('E1008', 'E1006'), ('E1009', 'E1004'),
    ('E1010', 'E1003'), ('E1011', 'E1010'), ('E1012', 'E1003'), ('E1013', 'E1012'),
    ('E1014', 'E1001'), ('E1015', 'E1014'), ('E1016', 'E1002'), ('E1017', 'E1016'),
    ('E1018', 'E1017'), ('E1019', 'E1017'), ('E1020', 'E1021'), ('E1021', 'E1016'),
    ('E1022', 'E1021'), ('E1023', 'E1024'), ('E1024', 'E1016'), ('E1025', 'E1017'),
    ('E1026', 'E1027'), ('E1027', 'E1016'), ('E1028', 'E1021'), ('E1029', 'E1017'),
    ('E1030', 'E1017'), ('E1031', 'E1024'), ('E1032', 'E1017'), ('E1033', 'E1021'),
    ('E1034', 'E1021'), ('E1035', 'E1027'), ('E1036', 'E1037'), ('E1037', 'E1016'),
    ('E1038', 'E1037'), ('E1039', 'E1002'), ('E1040', 'E1039'), ('E1041', 'E1040'),
    ('E1042', 'E1040'), ('E1043', 'E1039'), ('E1044', 'E1040'), ('E1045', 'E1040'),
    ('E1046', 'E1040'), ('E1047', 'E1002'), ('E1048', 'E1047'), ('E1049', 'E1047'),
    ('E1050', 'E1047'), ('E1051', 'E1048'), ('E1052', 'E1049'), ('E1053', 'E1050'),
    ('E1054', 'E1002'), ('E1055', 'E1054'), ('E1056', 'E1054'), ('E1057', 'E1055'),
    ('E1058', 'E1054'), ('E1059', 'E1054'), ('E1060', 'E1054'), ('E1061', 'E1054'),
    ('E1062', 'E1054'), ('E1063', 'E1055'), ('E1064', 'E1054'), ('E1065', 'E1005'),
    ('E1066', 'E1039'), ('E1067', 'E1005'), ('E1068', 'E1039')
)
update employees employee
set manager_employee_id = manager.id, updated_at = now()
from manager_map mapping
join employees manager on manager.employee_code = mapping.manager_code
where employee.tenant_id = manager.tenant_id
  and employee.employee_code = mapping.employee_code
  and employee.manager_employee_id is distinct from manager.id;

--> statement-breakpoint

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'employees_manager_not_self_check'
  ) then
    alter table employees
      add constraint employees_manager_not_self_check
      check (manager_employee_id is null or manager_employee_id <> id);
  end if;
end $$;
