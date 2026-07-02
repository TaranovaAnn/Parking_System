import { Component, OnInit, computed, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ZoneService } from '../../core/services/zone.service';
import { ParkingZone } from '../../core/models/zone.model';
import { ZoneEditDialogComponent } from './zone-edit-dialog/zone-edit-dialog.component';

interface ZoneRow extends ParkingZone {
  occupied: number;
  free: number;
  percent: number;
}

@Component({
  selector: 'app-zones',
  standalone: true,
  imports: [
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  templateUrl: './zones.component.html',
  styleUrl: './zones.component.scss',
})
export class ZonesComponent implements OnInit {
  private readonly zoneService = inject(ZoneService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly zoneRows = computed<ZoneRow[]>(() => {
    this.zoneService.zones();
    return this.zoneService.zones().map((zone) => {
      const occupied = this.zoneService.getOccupiedCount(zone.id);
      const free = Math.max(0, zone.capacity - occupied);
      const percent = zone.capacity ? Math.round((occupied / zone.capacity) * 100) : 0;
      return { ...zone, occupied, free, percent };
    });
  });

  readonly totalCapacity = computed(() =>
    this.zoneRows().reduce((sum, z) => sum + z.capacity, 0),
  );

  readonly totalOccupied = computed(() =>
    this.zoneRows().reduce((sum, z) => sum + z.occupied, 0),
  );

  readonly displayedColumns = ['name', 'capacity', 'occupied', 'free', 'load', 'actions'];

  ngOnInit(): void {
    this.zoneService.load();
  }

  openEdit(zone: ParkingZone): void {
    const ref = this.dialog.open(ZoneEditDialogComponent, {
      width: '440px',
      data: zone,
    });

    ref.afterClosed().subscribe((result) => {
      if (!result) {
        return;
      }

      this.zoneService.updateZoneRequest(zone.id, result).subscribe(() => {
        this.snackBar.open(`Зона «${result.name}» обновлена`, 'OK', { duration: 3000 });
      });
    });
  }
}
