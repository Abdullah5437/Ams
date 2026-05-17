'use client';
import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { json2csv } from 'json-2-csv';
import Link from 'next/link';
import end_points from '../../../../api_url';

function RouteList() {
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedValue, setSelectedValue] = useState([]);
  const [selectedItem, setSelectedItem] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filteredVouchers, setFilteredVouchers] = useState([]);
  const [partyOptions, setPartyOptions] = useState([]);
  const [itemOptions, setItemOptions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [vouchers, setVouchers] = useState([]);
  const [voucherDetails, setVoucherDetails] = useState([]);
  const [saleDetails, setSaleDetails] = useState([]);

  const salesPerPage = 50;
  const indexOfLastSale = currentPage * salesPerPage;
  const indexOfFirstSale = indexOfLastSale - salesPerPage;
  const currentVouchers = Array.isArray(filteredVouchers)
    ? filteredVouchers.slice(indexOfFirstSale, indexOfLastSale)
    : [];
  const totalPages = Math.ceil(filteredVouchers.length / salesPerPage);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [voucherRes, detailRes, partyRes, itemRes, saleDetailRes] = await Promise.all([
          axios.get(`${end_points}/voucher/getAll`),
          axios.get(`${end_points}/voucherDetail/getAll`),
          axios.get(`${end_points}/parties/getAll`),
          axios.get(`${end_points}/items/getAll`),
          axios.get(`${end_points}/saleDetail/getAll`), // New call
        ]);

        const allVouchers = voucherRes.data || [];
        const allVoucherDetails = detailRes.data || [];
        const allSaleDetails = saleDetailRes.data || [];

        let svVouchers = allVouchers.filter(v => v.voucher_type === 'SV');

        setVouchers(svVouchers);
        setVoucherDetails(allVoucherDetails);
        setSaleDetails(allSaleDetails); // Store freight sale details
        const parties = partyRes.data
          .filter(p => p.status)
          .map(p => ({ value: p.party_code, label: p.name }));
        setPartyOptions(parties);

        const saleItems = itemRes.data
          .filter(item => item.type === 'Sale')
          .map(item => ({ value: String(item.id), label: item.name }));

        setItemOptions([{ value: 'all', label: 'All' }, ...saleItems]);

        setLoading(false);
      } catch (err) {
         ('Error fetching data:', err);
      }
    };

    fetchInitialData();
  }, []);

  const parseParticulars = (text) => {
    const regex = /:\s*([A-Za-z]+)\s*(\d+(?:\.\d+)?)kg\.?@(\d+(?:\.\d+)?)/i;
    const match = text.match(regex);
    if (match) {
      return {
        item: match[1].trim(),
        weight: parseFloat(match[2]),
        rate: parseFloat(match[3]),
      };
    }
    return { item: '-', weight: 0, rate: 0 };
  };

  const getFreightByVoucherId = (voucherId) => {
    const match = saleDetails.find(s => Number(s.sale_id) === Number(voucherId));
    return match ? parseFloat(match.frieght || 0) : 0;
  };

  const formatPKR = (amount) => {
    const rounded = Math.round(amount);
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(rounded);
  };

  const handleSearch = () => {
    const searchLower = searchTerm.toLowerCase();

    const filtered = vouchers.filter((voucher) => {
      const dateOnly = new Date(voucher.voucher_date).toISOString().split('T')[0];

      const details = voucherDetails.filter(d => Number(d.main_id) === Number(voucher.id));
      if (!details.length) return false;

      const particulars = parseParticulars(details[0]?.particulars || '');
      const item = particulars.item;
      const weight = particulars.weight;
      const rate = particulars.rate;

      const gross = weight * rate;
      const freight = getFreightByVoucherId(voucher.id);
      const net = gross - freight;

      const itemFilter =
        selectedItem.length === 0 ||
        selectedItem.some(itemOption =>
          itemOption.value === 'all' || item.toLowerCase().includes(itemOption.label.toLowerCase())
        );

      const detailAccountCode = details[0]?.account_code;

      const partyFilter =
        selectedValue.length === 0 ||
        selectedValue.some(p => p.value === detailAccountCode);

      const startFilter = !startDate || dateOnly >= startDate;
      const endFilter = !endDate || dateOnly <= endDate;

      const searchMatch = [
        voucher.voucher_id,
        dateOnly,
        item,
        weight,
        rate,
        formatPKR(gross),
        formatPKR(freight),
        formatPKR(net)
      ].some(field => String(field).toLowerCase().includes(searchLower));

      return itemFilter && partyFilter && startFilter && endFilter && searchMatch;
    });

    setFilteredVouchers(filtered);
    setCurrentPage(1);
  };

  useEffect(() => {
    handleSearch();
  }, [searchTerm, vouchers, voucherDetails, selectedValue, selectedItem, startDate, endDate]);
const groupByParty = () => {
  // Group vouchers by `account_code`
  const grouped = filteredVouchers.reduce((acc, voucher) => {
    const details = voucherDetails.filter(d => d.main_id === voucher.id);
    if (details.length) {
      const accountCode = details[0]?.account_code;
      if (!acc[accountCode]) {
        acc[accountCode] = [];
      }
      acc[accountCode].push(voucher);
    }
    return acc;
  }, {});

  // Sort parties by name or other criteria if needed
  const sortedParties = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  return sortedParties.map(partyCode => {
    const partyVouchers = grouped[partyCode];
    const partyTotal = partyVouchers.reduce((total, voucher) => {
      const details = voucherDetails.filter(d => d.main_id === voucher.id);
      const particulars = parseParticulars(details[0]?.particulars || '');
      const gross = particulars.weight * particulars.rate;
      const freight = getFreightByVoucherId(voucher.id);
      return total + (gross - freight);
    }, 0);

    // Find the party name from partyOptions by matching accountCode (from voucher details) and partyCode (from partyOptions)
    const partyName = partyOptions.find(p => p.value === partyCode)?.label || 'Unknown Party';

    return {
      partyName,
      partyVouchers,
      partyTotal,
    };
  });
};


 const exportToCSV = async () => {
    try {
      const csv = await json2csv(filteredVouchers);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'sales.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
       ('CSV export error:', err);
    }
  };

const exportToExcel = () => {
  const wb = XLSX.utils.book_new();
  let wsData = [];
  
  // Title
  wsData.push(["Sales Report"]);
  
  // Date range if available
  if (startDate && endDate) {
    wsData.push([`From: ${startDate}`, `To: ${endDate}`]);
  }
  wsData.push([]);

  // Loop over parties
  groupByParty().forEach((party) => {
    // Party header row (light gray, centered)
    wsData.push([`Party: ${party.partyName}`]);
    wsData.push(["#", "Date", "Vr#", "Item Name", "Weight", "Rate", "Gross Amount", "Freight", "Net Amount"]);

    party.partyVouchers.forEach((voucher, index) => {
      const details = voucherDetails.filter(d => Number(d.main_id) === Number(voucher.id));
      const particulars = parseParticulars(details[0]?.particulars || '');
      const gross = particulars.weight * particulars.rate;
      const freight = getFreightByVoucherId(voucher.id);
      const net = gross - freight;

      wsData.push([
        index + 1,
        new Date(voucher.voucher_date).toISOString().split("T")[0],
        voucher.voucher_id,
        particulars.item,
        particulars.weight,
        particulars.rate,
        formatPKR(gross),
        formatPKR(freight),
        formatPKR(net)
      ]);
    });

    // Party total row
    wsData.push([`Total for ${party.partyName}`, "", "", "", "", "", "", "", formatPKR(party.partyTotal)]);
    wsData.push([]);
  });

  // Create sheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Styling: only works if you use XLSX-style-compatible library (like xlsx-style)
  // Here’s basic width setting
  ws["!cols"] = [
    { wch: 5 }, { wch: 12 }, { wch: 8 }, { wch: 25 }, { wch: 10 },
    { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Sales");
  XLSX.writeFile(wb, "sales.xlsx");
};


const exportToPDF = () => {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(14);
  doc.text('Sales Report', 14, 15);

  // Date range if available
  if (startDate && endDate) {
    doc.setFontSize(10);
    doc.text(`From: ${startDate}  To: ${endDate}`, 14, 22);
  }

  let startY = startDate && endDate ? 28 : 22;

  // Loop over grouped parties
  groupByParty().forEach((party) => {
    // Party name row - centered with light gray background
    doc.setFillColor(220, 220, 220); // Light gray
    doc.rect(14, startY, 180, 8, 'F');
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');

    // Center text
    const pageWidth = doc.internal.pageSize.getWidth();
    const textWidth = doc.getTextWidth(`Party: ${party.partyName}`);
    const textX = (pageWidth - textWidth) / 2;
    doc.text(`Party: ${party.partyName}`, textX, startY + 6);

    startY += 10;
    doc.setFont(undefined, 'normal');

    // Table for this party
    autoTable(doc, {
      startY: startY,
      head: [['#', 'Date', 'Vr#', 'Item Name', 'Weight', 'Rate', 'Gross Amount', 'Freight', 'Net Amount']],
      body: party.partyVouchers.map((voucher, index) => {
        const details = voucherDetails.filter(d => Number(d.main_id) === Number(voucher.id));
        const particulars = parseParticulars(details[0]?.particulars || '');
        const gross = particulars.weight * particulars.rate;
        const freight = getFreightByVoucherId(voucher.id);
        const net = gross - freight;

        return [
          index + 1,
          new Date(voucher.voucher_date).toISOString().split('T')[0],
          voucher.voucher_id,
          particulars.item,
          particulars.weight,
          particulars.rate,
          formatPKR(gross),
          formatPKR(freight),
          formatPKR(net)
        ];
      }),
      headStyles: {
        fillColor: [64, 64, 64], // Dark gray
        textColor: [255, 255, 255], // White text
      },
      styles: {
        fontSize: 9,
      },
    });

    startY = doc.lastAutoTable.finalY + 6;

    // Party total row: Party name left, total amount right
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');

    // Left side: Party name
    doc.text(`Total for ${party.partyName}:`, 16, startY);

    // Right side: Total amount
    const totalText = formatPKR(party.partyTotal);
    const totalX = pageWidth - doc.getTextWidth(totalText) - 16;
    doc.text(totalText, totalX, startY);

    doc.setFont(undefined, 'normal');
    startY += 10;
  });

  doc.save('sales.pdf');
};




 const handlePrint = () => {
  const printWindow = window.open('', '', 'width=800,height=600');

  let htmlContent = `<h2 style="text-align:center;">Sales Report</h2>`;
  if (startDate && endDate) {
    htmlContent += `<p style="text-align:center;">From: ${startDate} &nbsp;&nbsp; To: ${endDate}</p>`;
  }

  groupByParty().forEach((party) => {
    // Party name row
    htmlContent += `
      <table style="width:100%; border-collapse:collapse; font-family:Arial, sans-serif; font-size:12px; margin-bottom:20px;">
        <tr>
          <td colspan="9" style="background-color:#d3d3d3; text-align:center; font-weight:bold; padding:6px;">
            ${party.partyName}
          </td>
        </tr>
        <tr style="background-color:#555; color:white;">
          <th>#</th>
          <th>Date</th>
          <th>Vr#</th>
          <th>Item Name</th>
          <th>Weight</th>
          <th>Rate</th>
          <th>Gross Amount</th>
          <th>Freight</th>
          <th>Net Amount</th>
        </tr>
    `;

    // Party vouchers
    party.partyVouchers.forEach((voucher, index) => {
      const details = voucherDetails.filter(d => Number(d.main_id) === Number(voucher.id));
      const particulars = parseParticulars(details[0]?.particulars || '');
      const gross = particulars.weight * particulars.rate;
      const freight = getFreightByVoucherId(voucher.id);
      const net = gross - freight;

      htmlContent += `
        <tr>
          <td>${index + 1}</td>
          <td>${new Date(voucher.voucher_date).toISOString().split("T")[0]}</td>
          <td>${voucher.voucher_id}</td>
          <td>${particulars.item}</td>
          <td>${particulars.weight}</td>
          <td>${particulars.rate}</td>
          <td>${formatPKR(gross)}</td>
          <td>${formatPKR(freight)}</td>
          <td>${formatPKR(net)}</td>
        </tr>
      `;
    });

    // Total row
    htmlContent += `
      <tr>
        <td colspan="8" style="font-weight:bold;">Total for ${party.partyName}</td>
        <td style="font-weight:bold; text-align:right;">${formatPKR(party.partyTotal)}</td>
      </tr>
    </table>
    `;
  });

  printWindow.document.write(`
    <html>
      <head>
        <title>Print</title>
        <style>
          th, td { border: 1px solid #333; padding: 6px 8px; text-align: left; }
          table { border: 1px solid #333; }
        </style>
      </head>
      <body>${htmlContent}</body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
};

   const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };
 const getVoucherLink = (voucher) => {
    const { voucher_type, id, voucher_id } = voucher;

    if (voucher_type === 'PV') {
      return `/Pages/Dashboard/Vouchers/Voucher/PV/${voucher_id}/${id}`;
    } else if (voucher_type === 'BP' || voucher_type === 'BR') {
      return `/Pages/Dashboard/Vouchers/Voucher/BP_BR/${id}/${voucher_id}`;
    } else if (voucher_type === 'CP' || voucher_type === 'CR') {
      return `/Pages/Dashboard/Vouchers/Voucher/CP_CR/${id}/${voucher_id}`;
    } else if (voucher_type === 'JV' || voucher_type === 'BRV') {
      return `/Pages/Dashboard/Vouchers/Voucher/JV_BRV/${id}/${voucher_id}`;
    }
    else {
      return `/Pages/Dashboard/Vouchers/Voucher/${voucher_type}/${id}/${voucher_id}`;
    }
  };
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-white">
        <div className="flex space-x-2">
          <span className="w-3 h-3 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
          <span className="w-3 h-3 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
          <span className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></span>
          <span className="w-3 h-3 bg-blue-500 rounded-full animate-bounce [animation-delay:0.15s]"></span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 text-black">
     <h2 className="text-xl font-semibold text-gray-700 border-b pb-4 mb-4">Customers Wise Report</h2>

      {/* Filters */}
     

       <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-900 mb-2">Party Name</label>
          <Select isMulti value={selectedValue} onChange={setSelectedValue} options={partyOptions} />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-900">Start Date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full mt-2 px-4 py-2 border rounded-md text-sm" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-900">End Date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full mt-2 px-4 py-2 border rounded-md text-sm" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-900 mb-2">Item Name</label>
          <Select
            isMulti
            value={selectedItem}
            onChange={(selected) =>
              selected.some((item) => item.value === 'all')
                ? setSelectedItem([{ value: 'all', label: 'All' }])
                : setSelectedItem(selected)
            }
            options={itemOptions}
          />
        </div>
      </div>
<div className="mt-4 flex gap-2">
        <button className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm" onClick={handleSearch}>Search</button>
        <button className="px-4 py-2 bg-gray-500 text-white rounded-md text-sm"
          onClick={() => {
           setFilteredVouchers(vouchers)
            setSelectedValue([]);
            setSelectedItem([]);
            setStartDate('');
            setEndDate('');
            setCurrentPage(1);
            setSearchTerm('');
          }}
        >Reset</button>
      </div>
      {/* Voucher Table */}
      <div className="overflow-x-auto bg-white rounded-lg mt-6">
          <div className="mt-6 flex justify-between items-center flex-wrap gap-4 mb-4">
          <div className="flex gap-2">
            <button onClick={exportToCSV} className="px-3 py-2 text-sm bg-gray-500 text-white rounded-md">CSV</button>
            <button onClick={exportToExcel} className="px-3 py-2 text-sm bg-gray-500 text-white rounded-md">Excel</button>
            <button onClick={exportToPDF} className="px-3 py-2 text-sm bg-gray-500 text-white rounded-md">PDF</button>
            <button onClick={handlePrint} className="px-3 py-2 text-sm bg-gray-500 text-white rounded-md">Print</button>
          </div>
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border rounded-md text-sm w-full max-w-[300px]"
          />
        </div>
       {selectedValue.length >0 ? <table className="min-w-full border-collapse">
          <thead className="bg-gray-500">
            <tr>
              {['#', 'Date', 'Vr#', 'Item Name', 'Weight', 'Rate', 'Gross Amount', 'Freight', 'Net Amount'].map(header => (
                <th key={header} className="px-6 py-3 text-left text-sm font-medium text-white uppercase">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groupByParty().map((party, partyIndex) => (
              <React.Fragment key={partyIndex}>
                {/* Display Vouchers for this party */}
                {party.partyVouchers.map((voucher, index) => {
                  const details = voucherDetails.filter(d => d.main_id === voucher.id);
                  const particulars = parseParticulars(details[0]?.particulars || '');
                  const gross = particulars.weight * particulars.rate;
                  const freight = getFreightByVoucherId(voucher.id);
                  const net = gross - freight;

                  return (
                    <tr key={voucher.id} className="border-t">
                      <td className="px-6 py-4 text-sm">{indexOfFirstSale + index + 1}</td>
                      <td className="px-6 py-4 text-sm">{new Date(voucher.voucher_date).toISOString().split('T')[0]}</td>
                       <td className="px-6 py-4 text-sm text-gray-700">
                      <Link
                        className='hover:bg-gray-100 px-6 py-3 text-blue-500'
                        href={getVoucherLink(voucher)}
                      >
                       {voucher.voucher_id}
                      </Link>
                    </td>
                      <td className="px-6 py-4 text-sm">{particulars.item}</td>
                      <td className="px-6 py-4 text-sm">{particulars.weight}</td>
                      <td className="px-6 py-4 text-sm">{particulars.rate}</td>
                      <td className="px-6 py-4 text-sm">{formatPKR(gross)}</td>
                      <td className="px-6 py-4 text-sm">{formatPKR(freight)}</td>
                      <td className="px-6 py-4 text-sm">{formatPKR(net)}</td>
                    </tr>
                  );
                })}
                {/* Display Total for this party */}
                <tr className="bg-gray-200">
                  <td colSpan="8" className="px-6 py-4 text-sm font-semibold">Total for {party.partyName}</td>
                  <td className="px-6 py-4 text-sm font-semibold">{formatPKR(party.partyTotal)}</td>
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>:<div  className='px-2 py-4 text-lg text-gray-400 text-center w-full h-72 flex items-center justify-center'>Select a party to see the details </div>}
      </div>
       {selectedValue.length >0 ? <div className="flex justify-between items-center mt-8">
        <span className="text-sm text-gray-700">
          Showing {indexOfFirstSale + 1} to {Math.min(indexOfLastSale, filteredVouchers.length)} of {filteredVouchers.length} entries
        </span>
        <ol className="flex gap-1 text-xs font-medium">
          <li>
            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="inline-flex items-center justify-center w-8 h-8 rounded border border-gray-300 bg-white text-gray-900">&lt;</button>
          </li>
          {Array.from({ length: totalPages }, (_, i) => (
            <li key={i}>
              <button onClick={() => handlePageChange(i + 1)} className={`w-8 h-8 rounded border text-center leading-8 ${currentPage === i + 1 ? 'bg-blue-600 text-white' : 'border-gray-300 bg-white text-gray-900'}`}>{i + 1}</button>
            </li>
          ))}
          <li>
            <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="inline-flex items-center justify-center w-8 h-8 rounded border border-gray-300 bg-white text-gray-900">&gt;</button>
          </li>
        </ol>
      </div> :null}
    </div>
  );
}

export default RouteList;
