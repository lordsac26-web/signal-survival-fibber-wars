import { useAuth } from '@/lib/AuthContext';
import SignalSurvival from '@/components/game/SignalSurvival';
export default function Player(){const {user}=useAuth();return <SignalSurvival key={user.id} ownerId={user.id}/>}