import { Navigate, Route, Routes } from 'react-router-dom'
import { GuestFlowShell } from './components/GuestFlowShell'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminPage } from './pages/AdminPage'
import { AdminPartiesPage } from './pages/AdminPartiesPage'
import { AdminPartyDetailPage } from './pages/AdminPartyDetailPage'
import { AdminPartyRequestsPage } from './pages/AdminPartyRequestsPage'
import { AdminSongFormPage } from './pages/AdminSongFormPage'
import { AdminSongLyricsPage } from './pages/AdminSongLyricsPage'
import { AdminSongsListPage } from './pages/AdminSongsListPage'
import { AdminSettingsPage } from './pages/AdminSettingsPage'
import { AdminPasswordResetRequestsPage } from './pages/AdminPasswordResetRequestsPage'
import { HomePage } from './pages/HomePage'
import { HostPage } from './pages/HostPage'
import { HostPartyApprovalWaitingPage } from './pages/HostPartyApprovalWaitingPage'
import { HostPartyDetailPage } from './pages/HostPartyDetailPage'
import { HostPartyPlaylistPage } from './pages/HostPartyPlaylistPage'
import { HostPartyQrPage } from './pages/HostPartyQrPage'
import { HostPartyRequestNewPage } from './pages/HostPartyRequestNewPage'
import { JoinPage } from './pages/JoinPage'
import { PartyGuestPlaylistPage } from './pages/PartyGuestPlaylistPage'
import { PartyLobbyPage } from './pages/PartyLobbyPage'
import { LoginPage } from './pages/LoginPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { SignupPage } from './pages/SignupPage'
import { PublicContentNotFoundPage } from './pages/PublicContentNotFoundPage'
import { ProfilePage } from './pages/ProfilePage'
import { MySongsPage } from './pages/MySongsPage'
import { MySongsPracticePage } from './pages/MySongsPracticePage'

export function App() {
  return (
    <Routes>
      <Route
        path="/join/:partyCode"
        element={
          <GuestFlowShell>
            <JoinPage />
          </GuestFlowShell>
        }
      />
      <Route
        path="/party/:partyCode/playlist"
        element={
          <GuestFlowShell>
            <PartyGuestPlaylistPage />
          </GuestFlowShell>
        }
      />
      <Route
        path="/party/:partyCode"
        element={
          <GuestFlowShell mode="karaoke">
            <PartyLobbyPage />
          </GuestFlowShell>
        }
      />
      <Route element={<Layout />}>
        <Route path="/host" element={<Navigate to="/host/dashboard" replace />} />
        <Route path="/songs" element={<PublicContentNotFoundPage />} />
        <Route path="/songs/*" element={<PublicContentNotFoundPage />} />
        <Route path="/lyrics" element={<PublicContentNotFoundPage />} />
        <Route path="/lyrics/*" element={<PublicContentNotFoundPage />} />
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/account/profile"
          element={
            <ProtectedRoute need="host">
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-songs"
          element={
            <ProtectedRoute need="host">
              <MySongsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-songs/practice/:songId"
          element={
            <ProtectedRoute need="host">
              <MySongsPracticePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/host/dashboard"
          element={
            <ProtectedRoute need="host">
              <HostPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/host/parties/new"
          element={
            <ProtectedRoute need="host">
              <HostPartyRequestNewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/host/party-requests/:partyId/waiting"
          element={
            <ProtectedRoute need="host">
              <HostPartyApprovalWaitingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/host/parties/:partyId/qr"
          element={
            <ProtectedRoute need="host">
              <HostPartyQrPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/host/parties/:partyId/playlist"
          element={
            <ProtectedRoute need="host">
              <HostPartyPlaylistPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/host/parties/:partyId"
          element={
            <ProtectedRoute need="host">
              <HostPartyDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/songs/new"
          element={
            <ProtectedRoute need="super_admin">
              <AdminSongFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/songs/:songId/lyrics"
          element={
            <ProtectedRoute need="super_admin">
              <AdminSongLyricsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/songs/:songId/edit"
          element={
            <ProtectedRoute need="super_admin">
              <AdminSongFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/songs"
          element={
            <ProtectedRoute need="super_admin">
              <AdminSongsListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute need="super_admin">
              <AdminSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/password-reset-requests"
          element={
            <ProtectedRoute need="super_admin">
              <AdminPasswordResetRequestsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/party-requests"
          element={
            <ProtectedRoute need="super_admin">
              <AdminPartyRequestsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/parties/:partyId"
          element={
            <ProtectedRoute need="super_admin">
              <AdminPartyDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/parties"
          element={
            <ProtectedRoute need="super_admin">
              <AdminPartiesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute need="super_admin">
              <AdminPage />
            </ProtectedRoute>
          }
        />
        <Route path="/join" element={<JoinPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
