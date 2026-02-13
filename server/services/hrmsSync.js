/**
 * HRMS Sync: fetch active employees from HRMS API and upsert into Employee / SupportStaff.
 * Used by cron (daily 10 PM) and by manual "Sync with HRMS" (POST /api/admin/hrms-sync).
 */

import { ApiConfig, Employee, SupportStaff } from '../models/index.js';

const SUPPORT_STAFF_DESIGNATIONS = ['Driver', 'Office Assistant'];

async function fetchHrmsEmployeesFromApi() {
  const cfg = await ApiConfig.findOne({ where: { isActive: true } });
  if (!cfg || !cfg.baseUrl) {
    throw new Error('API Config not set');
  }
  const base = cfg.baseUrl.replace(/\/$/, '');
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (cfg.accessToken) headers['Authorization'] = `Bearer ${cfg.accessToken}`;
  if (cfg.apiKey) headers['x-api-key'] = cfg.apiKey;
  if (cfg.headersJson) {
    try {
      Object.assign(headers, JSON.parse(cfg.headersJson));
    } catch {}
  }

  const all = [];
  const maxPages = 50;
  let totalPages = 1;
  let currentPage = 1;

  do {
    const url = `${base}/api/employees/active${currentPage > 1 ? `?page=${currentPage}` : ''}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    let resp;
    try {
      resp = await fetch(url, { method: 'GET', headers, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`HRMS API error ${resp.status}: ${text || resp.statusText}`);
    }
    const data = await resp.json();
    const list = Array.isArray(data) ? data : data?.results || [];
    all.push(...list);
    if (data?.meta?.total_pages != null) totalPages = Number(data.meta.total_pages) || 1;
    if (list.length === 0) break;
    currentPage++;
  } while (currentPage <= Math.min(totalPages, maxPages));

  return all;
}

/**
 * Run full HRMS sync: fetch from API, then create or update Employee / SupportStaff.
 * Returns { created: { employees, supportStaff }, updated: { employees, supportStaff }, error? }.
 */
export async function runHrmsSync() {
  const result = {
    created: { employees: 0, supportStaff: 0 },
    updated: { employees: 0, supportStaff: 0 },
  };

  try {
    const hrmsEmployees = await fetchHrmsEmployeesFromApi();
    const today = new Date().toISOString().split('T')[0];

    for (let i = 0; i < hrmsEmployees.length; i++) {
      const emp = hrmsEmployees[i];
      try {
        const designation = emp.designation || '';
        const isSupport = SUPPORT_STAFF_DESIGNATIONS.some((d) =>
          designation.toLowerCase().includes(d.toLowerCase()),
        );

        if (isSupport) {
          const staffId = emp.employee_id || '';
          if (!staffId) continue;
          const payload = {
            name: emp.employee_name || '',
            email: emp.email || '',
            mobileNumber: emp.mobile_number || '',
            designation: emp.designation || '',
            companyName: emp.company?.company_name || '',
            biometricData: emp.qr_code_image || '',
            isActive: emp.is_active === 1 || emp.is_active === true,
          };
          const existing = await SupportStaff.findOne({ where: { staffId } });
          if (existing) {
            await existing.update(payload);
            result.updated.supportStaff++;
          } else {
            await SupportStaff.create({
              staffId,
              name: payload.name,
              email: payload.email,
              mobileNumber: payload.mobileNumber,
              designation: payload.designation,
              companyName: payload.companyName,
              biometricData: payload.biometricData,
              createdBy: 'HRMS Sync',
              createdDate: today,
              isActive: payload.isActive,
            });
            result.created.supportStaff++;
          }
        } else {
          const employeeId = emp.employee_id || '';
          if (!employeeId) continue;
          const payload = {
            employeeName: emp.employee_name || '',
            email: emp.email || '',
            companyName: emp.company?.company_name || '',
            entity: emp.designation || '',
            mobileNumber: emp.mobile_number || '',
            location: emp.branch?.branch_name || '',
            qrCode: emp.qr_code_image || '',
            isActive: emp.is_active === 1 || emp.is_active === true,
          };
          const existing = await Employee.findOne({ where: { employeeId } });
          if (existing) {
            await existing.update(payload);
            result.updated.employees++;
          } else {
            await Employee.create({
              employeeId,
              employeeName: payload.employeeName,
              email: payload.email,
              companyName: payload.companyName,
              entity: payload.entity,
              mobileNumber: payload.mobileNumber,
              location: payload.location,
              qrCode: payload.qrCode,
              createdBy: 'HRMS Sync',
              createdDate: today,
              isActive: payload.isActive,
            });
            result.created.employees++;
          }
        }
      } catch (err) {
        console.warn(`HRMS sync: skip record at index ${i}:`, err.message);
      }
    }

    return result;
  } catch (error) {
    console.error('HRMS sync error:', error);
    result.error = error.message;
    return result;
  }
}
