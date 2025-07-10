import '@testing-library/jest-dom';
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InvoiceDetailsModal from "./InvoiceDetailsModal";
import { AuthProvider } from "./AuthContext";
import { Invoice, LaundryCart, Product, Client, Cart } from "../types";

// Add a complete Invoice mock
const baseProps = {
  invoice: {
    id: 'inv-1',
    invoiceNumber: 1,
    carts: [],
    clientName: "Test Client",
    clientId: 'client-1',
    date: "2025-07-10",
    products: [],
    total: 0,
    status: 'active',
    totalWeight: 0,
    locked: false,
    verified: false,
    partiallyVerified: false,
    verifiedBy: undefined,
    verifiedAt: undefined,
    verifiedProducts: undefined,
    lockedBy: undefined,
    lockedAt: undefined,
    note: undefined,
    truckNumber: undefined,
    pickupGroupId: undefined,
    name: undefined,
    highlight: undefined,
  } as Invoice,
  onClose: jest.fn(),
  client: undefined,
  products: [],
  onAddCart: jest.fn(async (cartName: string) => ({ id: "1", name: "Cart 1", isActive: true } as LaundryCart)),
  onAddProductToCart: jest.fn(),
  refreshInvoices: jest.fn(),
};

describe("InvoiceDetailsModal", () => {
  it("renders invoice modal with invoice number", () => {
    render(
      <AuthProvider>
        <InvoiceDetailsModal {...baseProps} />
      </AuthProvider>
    );
    expect(screen.getByText(/Invoice #1/)).toBeInTheDocument();
    expect(screen.getByText(/Client: Test Client/)).toBeInTheDocument();
  });

  it("all main buttons work as expected", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(
      <AuthProvider>
        <InvoiceDetailsModal
          {...baseProps}
          onClose={onClose}
        />
      </AuthProvider>
    );

    // 1. Create New Cart button
    const createCartBtn = screen.getByRole("button", { name: /create new cart/i });
    expect(createCartBtn).toBeInTheDocument();
    await user.click(createCartBtn);
    expect(screen.getByPlaceholderText(/new cart name/i)).toBeInTheDocument();

    // 2. Cancel button (for new cart)
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelBtn);
    expect(screen.queryByPlaceholderText(/new cart name/i)).not.toBeInTheDocument();

    // 3. Edit Invoice Name button
    const editInvoiceBtn = screen.getByRole("button", { name: /edit invoice name/i });
    expect(editInvoiceBtn).toBeInTheDocument();
    await user.click(editInvoiceBtn);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    // Cancel edit
    const cancelEditBtn = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelEditBtn);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    // 5. Close (X) button
    const closeBtn = screen.getByLabelText("Close");
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
