import {
  createBranchAction,
  createRoomAction,
  deleteBranchAction,
  deleteRoomAction,
  updateBranchAction,
  updateRoomAction,
} from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

type BranchItem = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  status: "ACTIVE" | "INACTIVE";
};

type RoomItem = {
  id: string;
  name: string;
  capacity: number | null;
  status: "ACTIVE" | "INACTIVE";
  branch: {
    id: string;
    name: string;
  };
};

type ClassLocationManagerProps = {
  branches: BranchItem[];
  rooms: RoomItem[];
  redirectTo: string;
  locationUpdated?: string;
  locationError?: string;
};

const inputClass =
  "h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#08a7dc]";

export function ClassLocationManager({
  branches,
  rooms,
  redirectTo,
  locationUpdated,
  locationError,
}: ClassLocationManagerProps) {
  const activeBranches = branches.filter((item) => item.status === "ACTIVE");

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-slate-950">
          Cơ sở & phòng học
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Thêm, sửa hoặc ngừng dùng cơ sở/phòng học để chọn nhanh khi tạo lớp.
        </p>
      </div>

      {locationUpdated ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Đã cập nhật cơ sở/phòng học.
        </div>
      ) : null}
      {locationError === "room_duplicate" ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          Phòng học đã tồn tại trong cơ sở này.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[#17215c]">Cơ sở</h3>
          <form action={createBranchAction} className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <input name="name" required placeholder="Tên cơ sở" className={inputClass} />
            <input name="address" placeholder="Địa chỉ" className={inputClass} />
            <input name="phone" placeholder="Số điện thoại" className={inputClass} />
            <button
              type="submit"
              className="h-10 rounded-md bg-[#17215c] px-4 text-sm font-medium text-white hover:bg-[#25308d]"
            >
              Thêm
            </button>
          </form>

          <div className="space-y-2">
            {branches.map((branch) => (
              <div
                key={branch.id}
                className="grid gap-2 rounded-md border border-slate-100 bg-slate-50 p-2 md:grid-cols-[1fr_1fr_1fr_120px_auto_auto]"
              >
                <form
                  action={updateBranchAction.bind(null, branch.id)}
                  className="contents"
                >
                  <input type="hidden" name="redirectTo" value={redirectTo} />
                  <input name="name" defaultValue={branch.name} className={inputClass} />
                  <input name="address" defaultValue={branch.address ?? ""} className={inputClass} />
                  <input name="phone" defaultValue={branch.phone ?? ""} className={inputClass} />
                  <select name="status" defaultValue={branch.status} className={inputClass}>
                    <option value="ACTIVE">Đang dùng</option>
                    <option value="INACTIVE">Ngừng dùng</option>
                  </select>
                  <button
                    type="submit"
                    className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium hover:bg-slate-100"
                  >
                    Lưu
                  </button>
                </form>
                <form action={deleteBranchAction.bind(null, branch.id)}>
                  <input type="hidden" name="redirectTo" value={redirectTo} />
                  <ConfirmSubmitButton
                    message={`Xoá cơ sở ${branch.name}?`}
                    className="h-10 rounded-md px-3 text-sm font-medium text-rose-700 hover:bg-rose-50"
                  >
                    Xoá
                  </ConfirmSubmitButton>
                </form>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[#17215c]">Phòng học</h3>
          <form action={createRoomAction} className="grid gap-2 md:grid-cols-[1fr_1fr_120px_auto]">
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <select name="branchId" required className={inputClass}>
              <option value="">Chọn cơ sở</option>
              {activeBranches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            <input name="name" required placeholder="Tên phòng" className={inputClass} />
            <input name="capacity" type="number" min="0" placeholder="Sức chứa" className={inputClass} />
            <button
              type="submit"
              className="h-10 rounded-md bg-[#17215c] px-4 text-sm font-medium text-white hover:bg-[#25308d]"
            >
              Thêm
            </button>
          </form>

          <div className="space-y-2">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="grid gap-2 rounded-md border border-slate-100 bg-slate-50 p-2 md:grid-cols-[1fr_1fr_110px_120px_auto_auto]"
              >
                <form
                  action={updateRoomAction.bind(null, room.id)}
                  className="contents"
                >
                  <input type="hidden" name="redirectTo" value={redirectTo} />
                  <select name="branchId" defaultValue={room.branch.id} className={inputClass}>
                    {activeBranches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                  <input name="name" defaultValue={room.name} className={inputClass} />
                  <input
                    name="capacity"
                    type="number"
                    min="0"
                    defaultValue={room.capacity ?? ""}
                    className={inputClass}
                  />
                  <select name="status" defaultValue={room.status} className={inputClass}>
                    <option value="ACTIVE">Đang dùng</option>
                    <option value="INACTIVE">Ngừng dùng</option>
                  </select>
                  <button
                    type="submit"
                    className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium hover:bg-slate-100"
                  >
                    Lưu
                  </button>
                </form>
                <form action={deleteRoomAction.bind(null, room.id)}>
                  <input type="hidden" name="redirectTo" value={redirectTo} />
                  <ConfirmSubmitButton
                    message={`Xoá phòng ${room.name}?`}
                    className="h-10 rounded-md px-3 text-sm font-medium text-rose-700 hover:bg-rose-50"
                  >
                    Xoá
                  </ConfirmSubmitButton>
                </form>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
