'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { PRODUCTS, formatINR } from '../../data/products';
import { POLICIES, INTEGRATION_INFOS } from '../../data/policies';
import { Header } from '../../components/Header';
import { Footer } from '../../components/Footer';

const PROFILE_STORAGE_KEY = 'novatech-demo-profile';
const ADDRESSES_STORAGE_KEY = 'novatech-demo-addresses';
const CART_STORAGE_KEY = 'novatech-demo-cart';

interface Address {
  id: number;
  label: string;
  name: string;
  line1: string;
  city: string;
  pincode: string;
  phone: string;
  isDefault: boolean;
}

export default function ProfilePage() {
  // Profile State
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    email: '',
    mobile: '',
  });
  const [profileStatus, setProfileStatus] = useState<{ msg: string; type: 'success' | 'error' | '' }>({
    msg: '',
    type: '',
  });

  // Addresses State
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null);
  const [addressFormOpen, setAddressFormOpen] = useState(false);
  const [addressFormData, setAddressFormData] = useState({
    label: '',
    name: '',
    line1: '',
    city: '',
    pincode: '',
    phone: '',
  });
  const [addressStatus, setAddressStatus] = useState('');

  // Cart State (for shared header)
  const [cart, setCart] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog State (for header modals)
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [panelTitle, setPanelTitle] = useState('');
  const [panelBody, setPanelBody] = useState<React.ReactNode>(null);

  // 1. Recover Profile and Addresses from localStorage & sync cart
  useEffect(() => {
    try {
      const savedProfile = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (savedProfile) {
        setProfile(JSON.parse(savedProfile));
      }
      const savedAddresses = localStorage.getItem(ADDRESSES_STORAGE_KEY);
      if (savedAddresses) {
        setAddresses(JSON.parse(savedAddresses));
      }
    } catch {}

    const syncCart = () => {
      try {
        const savedCart = localStorage.getItem(CART_STORAGE_KEY);
        if (savedCart) {
          setCart(JSON.parse(savedCart));
        }
      } catch {}
    };

    syncCart();
    window.addEventListener('storage', syncCart);
    window.addEventListener('novatech:cart-updated', syncCart);
    return () => {
      window.removeEventListener('storage', syncCart);
      window.removeEventListener('novatech:cart-updated', syncCart);
    };
  }, []);

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  // Modal helpers
  const openPanel = useCallback((title: string, content: React.ReactNode) => {
    setPanelTitle(title);
    setPanelBody(content);
    if (dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
    }
  }, []);

  const closePanel = useCallback(() => {
    if (dialogRef.current?.open) {
      dialogRef.current.close();
    }
  }, []);

  const showCart = useCallback(() => {
    const entries = Object.entries(cart);
    const subtotal = entries.reduce((sum, [id, q]) => {
      const p = PRODUCTS.find((item) => item.id === id);
      return sum + (p ? p.price * q : 0);
    }, 0);

    openPanel(
      'Your bag',
      entries.length > 0 ? (
        <div>
          <div className="cart-lines-list">
            {entries.map(([id, q]) => {
              const p = PRODUCTS.find((item) => item.id === id);
              if (!p) return null;
              return (
                <div key={id} className="cart-line">
                  <div className="cart-line-info">
                    <strong>{p.name}</strong>
                    <div className="cart-item-price">{formatINR(p.price * q)}</div>
                  </div>
                  <div className="controls">
                    <span className="cart-qty-num">Qty: {q}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="cart-total">
            <span>Estimated subtotal</span>
            <span>{formatINR(subtotal)}</span>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={() => {
              const info = INTEGRATION_INFOS.checkout;
              openPanel(info.title, <p>{info.body}</p>);
            }}
          >
            Continue to checkout ↗
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '30px 10px' }}>
          <p style={{ fontSize: 16, marginBottom: 20 }}>Your bag is currently empty.</p>
          <button type="button" className="btn btn-primary" onClick={closePanel}>
            Continue exploring
          </button>
        </div>
      )
    );
  }, [cart, openPanel, closePanel]);

  const handleInfo = useCallback(
    (key: 'account' | 'orders' | 'checkout' | 'support') => {
      const info = INTEGRATION_INFOS[key];
      if (!info) return;
      openPanel(info.title, <p style={{ fontSize: 15, lineHeight: 1.5 }}>{info.body}</p>);
    },
    [openPanel]
  );

  const handlePolicy = useCallback(
    (key: string) => {
      const p = POLICIES[key];
      if (!p) return;
      openPanel('Ask NovaTech', <p>{p.content}</p>);
    },
    [openPanel]
  );

  // Identity computations
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  const avatarInitials =
    ((profile.firstName[0] || '') + (profile.lastName[0] || '')).toUpperCase() || 'N';

  // Profile Form Submissions
  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile.firstName || !profile.lastName || !profile.email || !profile.mobile) {
      setProfileStatus({
        msg: 'Please complete every field with a valid value.',
        type: 'error',
      });
      return;
    }

    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {}

    setProfileStatus({
      msg: 'Profile updated for this preview. Changes have been preserved locally.',
      type: 'success',
    });
  };

  const handleProfileReset = () => {
    try {
      const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (saved) {
        setProfile(JSON.parse(saved));
      } else {
        setProfile({ firstName: '', lastName: '', email: '', mobile: '' });
      }
    } catch {}
    setProfileStatus({ msg: 'Unsaved edits reset.', type: '' });
  };

  // Address Form Actions
  const openNewAddressForm = () => {
    setEditingAddressId(null);
    setAddressFormData({
      label: '',
      name: fullName || '',
      line1: '',
      city: '',
      pincode: '',
      phone: profile.mobile || '',
    });
    setAddressFormOpen(true);
  };

  const openEditAddressForm = (addr: Address) => {
    setEditingAddressId(addr.id);
    setAddressFormData({
      label: addr.label,
      name: addr.name,
      line1: addr.line1,
      city: addr.city,
      pincode: addr.pincode,
      phone: addr.phone,
    });
    setAddressFormOpen(true);
  };

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { label, name, line1, city, pincode, phone } = addressFormData;

    if (!label || !name || !line1 || !city || !pincode || !phone) {
      setAddressStatus('Please complete every address field.');
      return;
    }

    let updatedList: Address[];
    if (editingAddressId !== null) {
      updatedList = addresses.map((a) =>
        a.id === editingAddressId ? { ...a, ...addressFormData } : a
      );
    } else {
      const newAddress: Address = {
        id: Date.now(),
        ...addressFormData,
        isDefault: addresses.length === 0,
      };
      updatedList = [...addresses, newAddress];
    }

    setAddresses(updatedList);
    try {
      localStorage.setItem(ADDRESSES_STORAGE_KEY, JSON.stringify(updatedList));
    } catch {}

    setAddressFormOpen(false);
    setEditingAddressId(null);
    setAddressStatus('Address saved for this preview.');
  };

  const removeAddress = (id: number) => {
    const updated = addresses.filter((a) => a.id !== id);
    if (updated.length > 0 && updated[0] && !updated.some((a) => a.isDefault)) {
      updated[0].isDefault = true;
    }
    setAddresses(updated);
    try {
      localStorage.setItem(ADDRESSES_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    setAddressStatus('Address removed.');
  };

  const setDefaultAddress = (id: number) => {
    const updated = addresses.map((a) => ({
      ...a,
      isDefault: a.id === id,
    }));
    setAddresses(updated);
    try {
      localStorage.setItem(ADDRESSES_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    setAddressStatus('Default delivery address updated.');
  };

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      {/* Global Header */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        cartCount={cartCount}
        onOpenCart={showCart}
        onOpenInfo={handleInfo}
        onOpenPolicy={handlePolicy}
        selectedCategory="All"
        onSelectCategory={() => {}}
      />

      <main id="main" className="wrap profile-main">
        {/* Breadcrumb Navigation */}
        <div className="profile-breadcrumb">
          <Link href="/">Home</Link> / <span>My profile</span>
        </div>

        <h1 className="profile-headline">Your space. Your NovaTech.</h1>
        <p className="profile-intro">
          Manage your details, delivery addresses, and membership.
        </p>

        <div className="profile-layout">
          {/* Left Profile Sidebar */}
          <aside className="profile-sidebar" aria-label="Profile navigation">
            <div id="avatar" className="profile-avatar" aria-hidden="true">
              {avatarInitials}
            </div>
            <strong id="sidebar-name" className="sidebar-name">
              {fullName || 'Your profile'}
            </strong>
            <p id="sidebar-email" className="sidebar-email">
              {profile.email || 'Add your details to get started.'}
            </p>

            <div className="profile-sidebar-links">
              <a href="#personal">Personal details ↗</a>
              <a href="#addresses">Address book ↗</a>
              <a href="#membership">NovaClub ↗</a>
              <a href="#orders">My orders ↗</a>
              <a href="#security">Account security ↗</a>
            </div>
          </aside>

          {/* Right Profile Content Panels */}
          <div className="profile-content">
            {/* 1. Personal Details Panel */}
            <section id="personal" className="panel">
              <div className="panel-head">
                <h2>Personal details</h2>
                <span className="badge">Profile preview</span>
              </div>

              <form id="profile-form" onSubmit={handleProfileSubmit}>
                <div className="fields">
                  <label className="field-group">
                    <span>First name</span>
                    <input
                      name="firstName"
                      autoComplete="given-name"
                      maxLength={60}
                      value={profile.firstName}
                      onChange={(e) =>
                        setProfile((p) => ({ ...p, firstName: e.target.value }))
                      }
                      required
                    />
                  </label>

                  <label className="field-group">
                    <span>Last name</span>
                    <input
                      name="lastName"
                      autoComplete="family-name"
                      maxLength={60}
                      value={profile.lastName}
                      onChange={(e) =>
                        setProfile((p) => ({ ...p, lastName: e.target.value }))
                      }
                      required
                    />
                  </label>

                  <label className="field-group">
                    <span>Email address</span>
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      maxLength={150}
                      value={profile.email}
                      onChange={(e) =>
                        setProfile((p) => ({ ...p, email: e.target.value }))
                      }
                      required
                    />
                  </label>

                  <label className="field-group">
                    <span>Mobile number</span>
                    <input
                      name="mobile"
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      pattern="\+?[0-9 ()-]{10,20}"
                      title="Enter a mobile number using digits, with an optional country code."
                      maxLength={20}
                      value={profile.mobile}
                      onChange={(e) =>
                        setProfile((p) => ({ ...p, mobile: e.target.value }))
                      }
                      required
                    />
                  </label>
                </div>

                <div className="profile-actions">
                  <button className="btn btn-secondary" type="submit">
                    Save changes ↗
                  </button>
                  <button
                    className="btn btn-outline"
                    id="reset-profile"
                    type="button"
                    onClick={handleProfileReset}
                  >
                    Reset form
                  </button>
                </div>

                {profileStatus.msg && (
                  <p
                    id="profile-status"
                    className={`status-message ${profileStatus.type}`}
                    role="status"
                  >
                    {profileStatus.msg}
                  </p>
                )}
                <p className="notice" style={{ marginTop: 12 }}>
                  Frontend preview: details are stored locally in your browser.
                  Account saving will connect to the backend authentication service.
                </p>
              </form>
            </section>

            {/* 2. Address Book Panel */}
            <section id="addresses" className="panel">
              <div className="panel-head">
                <h2>Address book</h2>
                <button
                  className="text-button"
                  id="add-address"
                  type="button"
                  style={{ fontWeight: 600, fontSize: 13 }}
                  onClick={openNewAddressForm}
                >
                  + Add address
                </button>
              </div>

              {/* Address List */}
              <div id="address-list">
                {addresses.length > 0 ? (
                  addresses.map((address) => (
                    <article key={address.id} className="address-card">
                      <h3>
                        <span>{address.label}</span>
                        {address.isDefault && (
                          <span className="badge badge-subtle">Default</span>
                        )}
                      </h3>
                      <p>
                        <strong>{address.name}</strong>
                      </p>
                      <p>{address.line1}</p>
                      <p>
                        {address.city} · {address.pincode}
                      </p>
                      <p>{address.phone}</p>

                      <div className="profile-actions">
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => openEditAddressForm(address)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-button"
                          style={{ color: '#b91c1c' }}
                          onClick={() => removeAddress(address.id)}
                        >
                          Remove
                        </button>
                        {!address.isDefault && (
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => setDefaultAddress(address.id)}
                          >
                            Set as default
                          </button>
                        )}
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="address-empty">
                    No delivery addresses added in this preview yet.
                  </p>
                )}
              </div>

              {/* Add / Edit Address Form */}
              {addressFormOpen && (
                <form
                  id="address-form"
                  className="address-form-box"
                  onSubmit={handleAddressSubmit}
                >
                  <h3 id="address-form-title">
                    {editingAddressId !== null
                      ? 'Edit delivery address'
                      : 'Add a delivery address'}
                  </h3>

                  <div className="fields">
                    <label className="field-group">
                      <span>Address label</span>
                      <input
                        name="label"
                        placeholder="Home or work"
                        maxLength={40}
                        value={addressFormData.label}
                        onChange={(e) =>
                          setAddressFormData((prev) => ({
                            ...prev,
                            label: e.target.value,
                          }))
                        }
                        required
                      />
                    </label>

                    <label className="field-group">
                      <span>Recipient name</span>
                      <input
                        name="name"
                        autoComplete="shipping name"
                        maxLength={100}
                        value={addressFormData.name}
                        onChange={(e) =>
                          setAddressFormData((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        required
                      />
                    </label>

                    <label className="field-group full-width-field">
                      <span>Street address</span>
                      <input
                        name="line1"
                        autoComplete="shipping street-address"
                        maxLength={200}
                        value={addressFormData.line1}
                        onChange={(e) =>
                          setAddressFormData((prev) => ({
                            ...prev,
                            line1: e.target.value,
                          }))
                        }
                        required
                      />
                    </label>

                    <label className="field-group">
                      <span>City</span>
                      <input
                        name="city"
                        autoComplete="shipping address-level2"
                        maxLength={80}
                        value={addressFormData.city}
                        onChange={(e) =>
                          setAddressFormData((prev) => ({
                            ...prev,
                            city: e.target.value,
                          }))
                        }
                        required
                      />
                    </label>

                    <label className="field-group">
                      <span>Pincode</span>
                      <input
                        name="pincode"
                        autoComplete="shipping postal-code"
                        inputMode="numeric"
                        pattern="[1-9][0-9]{5}"
                        title="Enter a valid six-digit Indian pincode."
                        maxLength={6}
                        value={addressFormData.pincode}
                        onChange={(e) =>
                          setAddressFormData((prev) => ({
                            ...prev,
                            pincode: e.target.value,
                          }))
                        }
                        required
                      />
                    </label>

                    <label className="field-group">
                      <span>Phone number</span>
                      <input
                        name="phone"
                        type="tel"
                        autoComplete="shipping tel"
                        pattern="\+?[0-9 ()-]{10,20}"
                        maxLength={20}
                        value={addressFormData.phone}
                        onChange={(e) =>
                          setAddressFormData((prev) => ({
                            ...prev,
                            phone: e.target.value,
                          }))
                        }
                        required
                      />
                    </label>
                  </div>

                  <div className="profile-actions">
                    <button className="btn btn-primary" type="submit">
                      Save address
                    </button>
                    <button
                      className="btn btn-outline"
                      type="button"
                      onClick={() => setAddressFormOpen(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {addressStatus && (
                <p id="address-status" className="status-message" role="status">
                  {addressStatus}
                </p>
              )}
            </section>

            {/* 3. NovaClub Membership Panel */}
            <section id="membership" className="panel membership-panel">
              <p className="eyebrow-tag">NovaClub</p>
              <div className="panel-head">
                <h2>More with every milestone.</h2>
                <span className="badge">Membership preview</span>
              </div>

              <p className="notice">
                Your assigned tier will appear after sign-in. New customer accounts start at Standard.
              </p>

              <ul className="benefits-list">
                <li>
                  <strong>Standard:</strong> 1× reward points and free standard delivery above ₹5,000.
                </li>
                <li>
                  <strong>Silver:</strong> 1.5× points and priority support chat.
                </li>
                <li>
                  <strong>Gold:</strong> 2× points, free express delivery on every order and early access to sales.
                </li>
              </ul>

              <p className="notice">
                Source: NovaClub Membership Benefits · Version 2026.1. Membership tier is assigned by the account service.
              </p>
            </section>

            {/* 4. My Orders Section */}
            <section id="orders" className="panel">
              <div className="panel-head">
                <h2>My orders</h2>
                <span className="badge">Service pending</span>
              </div>
              <p className="muted" style={{ marginBottom: 16 }}>
                Connect your account to view orders and follow their progress from Confirmed to Packed, Shipped and Delivered.
              </p>
              <Link className="btn btn-outline" href="/search">
                Explore the collection ↗
              </Link>
            </section>

            {/* 5. Account Security Section */}
            <section id="security" className="panel">
              <h2>Account security</h2>
              <p className="muted" style={{ margin: '8px 0 12px' }}>
                Password changes and sign-out will become available when secure authentication is connected.
              </p>
              <p className="notice">
                This preview does not collect passwords or create an authenticated session.
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Global Footer */}
      <Footer onOpenInfo={handleInfo} onOpenPolicy={handlePolicy} />

      {/* Accessible Modal Dialog */}
      <dialog id="panel" ref={dialogRef} aria-labelledby="panel-title">
        <div className="dialog-head">
          <h2 id="panel-title">{panelTitle}</h2>
          <button
            type="button"
            className="plain dialog-close-btn"
            aria-label="Close dialog"
            onClick={closePanel}
          >
            ×
          </button>
        </div>
        <div id="panel-body">{panelBody}</div>
      </dialog>
    </>
  );
}
